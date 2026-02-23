import type {
  AgentConfig,
  AgentEvent,
  AgentEventStream,
  LLMAdapter,
  MessageContent,
  PermissionDecision,
  PermissionRequest,
  ToolCall,
  ToolResult,
} from '@cod/types';
import { PermissionMode } from '@cod/types';
import type { CodSettings } from '@cod/config';
import { ToolRegistry, createDefaultRegistry } from '@cod/tools';
import { PermissionEngine } from '@cod/permissions';
import { HookRunner } from '@cod/hooks';
import { MCPClientManager } from '@cod/mcp';
import { loadMemory, buildSystemPrompt, getGitContext } from '@cod/memory';
import { Session, SlidingWindowCompressor } from '@cod/session';
import type { SubagentConfig } from '@cod/types';

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-haiku-4-5': 200_000,
  'gpt-4o': 128_000,
  'gpt-4-turbo': 128_000,
  'gpt-3.5-turbo': 16_385,
  'gemini-1.5-pro': 1_048_576,
  'gemini-1.5-flash': 1_048_576,
};

function getContextWindow(model: string): number {
  return MODEL_CONTEXT_WINDOWS[model] ?? 100_000;
}

export class CodAgent {
  private config: AgentConfig;
  private settings: CodSettings;
  private adapter: LLMAdapter;
  private session: Session;
  private toolRegistry: ToolRegistry;
  private permissionEngine: PermissionEngine;
  private hookRunner: HookRunner;
  private mcpManager: MCPClientManager;
  private compressor: SlidingWindowCompressor;
  private systemPrompt = '';
  private abortController: AbortController;
  private initialized = false;

  constructor(config: AgentConfig, settings: CodSettings, adapter: LLMAdapter) {
    this.config = config;
    this.settings = settings;
    this.adapter = adapter;
    this.session = new Session(config.sessionId);
    this.toolRegistry = createDefaultRegistry();
    this.abortController = new AbortController();

    this.permissionEngine = new PermissionEngine(
      settings.permissionMode,
      settings.blockedCommands,
    );

    this.hookRunner = new HookRunner(settings.hooks);
    this.mcpManager = new MCPClientManager();

    this.compressor = new SlidingWindowCompressor(
      adapter,
      config.model,
      getContextWindow(config.model),
      settings.compactThreshold,
    );
  }

  setPermissionCallback(cb: (request: PermissionRequest) => Promise<PermissionDecision>): void {
    this.permissionEngine.setPromptCallback(cb);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.mcpManager.connectAll(this.settings.mcpServers);

    const mcpTools = await this.mcpManager.getAllTools();
    for (const { serverName, tool } of mcpTools) {
      this.toolRegistry.registerMcpTool(serverName, tool);
    }

    const memory = await loadMemory(this.config.workingDirectory);
    const gitContext = await getGitContext(this.config.workingDirectory);
    this.systemPrompt = buildSystemPrompt(memory, gitContext ?? undefined);

    this.initialized = true;
  }

  async *run(userMessage: string): AgentEventStream {
    if (!this.initialized) await this.initialize();

    this.session.addUserMessage(userMessage);

    // Check if compression is needed
    if (this.settings.autoCompact) {
      const needsCompression = await this.compressor.needsCompression(this.session);
      if (needsCompression) {
        const { before, after } = await this.compressor.compress(
          this.session,
          this.systemPrompt,
        );
        yield { type: 'context_compressed', before, after };
      }
    }

    yield { type: 'thinking_start' };

    // Agent loop
    while (!this.abortController.signal.aborted) {
      const llmTools = this.toolRegistry.toLLMTools();
      const messages = this.session.getMessages();

      // Accumulate the assistant's response
      const assistantContent: MessageContent[] = [];
      const toolCallsCompleted: ToolCall[] = [];
      let stopReason: import('@cod/types').StopReason = 'end_turn';
      let textBuffer = '';

      try {
        for await (const event of this.adapter.stream({
          model: this.config.model,
          messages,
          systemPrompt: this.systemPrompt,
          tools: llmTools,
          maxTokens: this.config.maxTokens ?? this.settings.maxTokens,
          temperature: this.config.temperature ?? this.settings.temperature,
          signal: this.abortController.signal,
        })) {
          if (this.abortController.signal.aborted) break;

          switch (event.type) {
            case 'text_delta':
              textBuffer += event.delta;
              yield { type: 'text_delta', text: event.delta };
              break;

            case 'tool_use_start': {
              // Flush text buffer before tool use
              if (textBuffer) {
                assistantContent.push({ type: 'text', text: textBuffer });
                textBuffer = '';
              }
              yield { type: 'tool_call_start', call: { id: event.id, name: event.name, input: {} } };
              break;
            }

            case 'tool_use_complete': {
              const call: ToolCall = { id: event.id, name: event.name, input: event.input };
              toolCallsCompleted.push(call);
              assistantContent.push({
                type: 'tool_use',
                id: event.id,
                name: event.name,
                input: event.input,
              });
              break;
            }

            case 'message_complete':
              stopReason = event.stopReason;
              yield { type: 'turn_complete', usage: event.usage, stopReason: event.stopReason };
              break;

            case 'error':
              yield { type: 'error', error: event.error, fatal: false };
              break;
          }
        }
      } catch (err) {
        yield {
          type: 'error',
          error: err instanceof Error ? err : new Error(String(err)),
          fatal: true,
        };
        return;
      }

      // Flush remaining text
      if (textBuffer) {
        assistantContent.push({ type: 'text', text: textBuffer });
      }

      this.session.addAssistantMessage(assistantContent);

      // If not tool use, we're done
      if (stopReason !== 'tool_use' || toolCallsCompleted.length === 0) break;

      // Execute tool calls sequentially, yielding events
      const toolResults: { toolCallId: string; result: ToolResult }[] = [];

      for (const call of toolCallsCompleted) {
        if (this.abortController.signal.aborted) break;

        for await (const event of this.executeToolCall(call)) {
          yield event;
          if (event.type === 'tool_call_complete') {
            toolResults.push({ toolCallId: call.id, result: event.result });
          } else if (event.type === 'tool_call_denied') {
            // Denied → return an error result so the LLM knows
            toolResults.push({
              toolCallId: call.id,
              result: { type: 'error', message: `Tool call denied: ${event.reason ?? 'permission denied'}` },
            });
          }
        }
      }

      this.session.addToolResults(toolResults);
    }
  }

  private async *executeToolCall(call: ToolCall): AsyncGenerator<AgentEvent> {
    const tool = this.toolRegistry.get(call.name);

    if (!tool) {
      yield {
        type: 'tool_call_complete',
        call,
        result: { type: 'error', message: `Unknown tool: ${call.name}` },
        durationMs: 0,
      };
      return;
    }

    // Run pre-tool-use hook
    const hookDecision = await this.hookRunner.runPreToolUse(
      call.name,
      call.input,
      this.config.workingDirectory,
    );

    if (hookDecision.type === 'deny') {
      yield { type: 'tool_call_denied', call, reason: hookDecision.reason };
      return;
    }

    const effectiveInput =
      hookDecision.type === 'modify' ? hookDecision.modifiedInput : call.input;
    const effectiveCall = { ...call, input: effectiveInput };

    // Build permission request
    const permRequest: PermissionRequest = {
      toolName: call.name,
      input: effectiveInput,
      description: `Execute ${call.name}`,
      isDestructive: tool.annotations?.destructive ?? false,
      isReadOnly: tool.annotations?.readOnly ?? false,
      requiresShell: tool.annotations?.requiresShell ?? false,
    };

    // Check permission (may prompt the user)
    const allowed = await this.permissionEngine.check(permRequest);
    if (!allowed) {
      yield { type: 'tool_call_denied', call: effectiveCall };
      return;
    }

    yield { type: 'tool_call_executing', call: effectiveCall };

    const start = Date.now();
    let result: ToolResult;

    try {
      result = await tool.execute(effectiveInput as never, {
        workingDirectory: this.config.workingDirectory,
        signal: this.abortController.signal,
        sessionId: this.session.id,
        requestPermission: (req) => this.permissionEngine.check(req),
        spawnSubagent: (config) => this.spawnSubagent(config),
      });
    } catch (err) {
      result = {
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      };
    }

    const durationMs = Date.now() - start;

    await this.hookRunner.runPostToolUse(
      call.name,
      effectiveInput,
      result,
      this.config.workingDirectory,
    );

    yield { type: 'tool_call_complete', call: effectiveCall, result, durationMs };
  }

  private async spawnSubagent(config: SubagentConfig): Promise<string> {
    const { LLMRegistry } = await import('@cod/llm');
    const { adapter } = LLMRegistry.createFromConfig(this.settings);

    const subAgent = new CodAgent(
      {
        model: config.model ?? this.config.model,
        provider: this.config.provider,
        workingDirectory: config.workingDirectory ?? this.config.workingDirectory,
        sessionId: config.taskId,
      },
      this.settings,
      adapter,
    );

    await subAgent.initialize();

    let result = '';
    for await (const event of subAgent.run(config.prompt)) {
      if (event.type === 'text_delta') {
        result += event.text;
      }
    }

    return result;
  }

  abort(): void {
    this.abortController.abort();
    this.abortController = new AbortController();
  }

  async cleanup(): Promise<void> {
    await this.hookRunner.runStop(this.session.id);
    await this.mcpManager.disconnectAll();
  }

  getSession(): Session {
    return this.session;
  }

  getPermissionEngine(): PermissionEngine {
    return this.permissionEngine;
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  updateSystemPrompt(extra: string): void {
    this.systemPrompt += '\n' + extra;
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }
}
