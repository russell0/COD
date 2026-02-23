import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const TaskInputSchema = z.object({
  description: z.string().describe('Short description of the task (3-5 words)'),
  prompt: z.string().describe('The detailed task for the subagent to perform'),
  subagent_type: z
    .string()
    .optional()
    .describe('Type of specialized subagent to use (e.g. "bash", "general-purpose")'),
});

type TaskInput = z.infer<typeof TaskInputSchema>;

export const TaskTool: ToolDefinition<TaskInput> = {
  name: 'Task',
  description:
    'Launch a subagent to handle a complex, multi-step task autonomously. Returns the subagent result as text.',
  inputSchema: TaskInputSchema,
  annotations: { readOnly: false },

  async execute(input: TaskInput, context: ToolExecutionContext): Promise<ToolResult> {
    if (!context.spawnSubagent) {
      return {
        type: 'error',
        message: 'Subagent spawning is not configured in this context.',
      };
    }

    try {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await context.spawnSubagent({
        taskId,
        description: input.description,
        prompt: input.prompt,
        workingDirectory: context.workingDirectory,
      });
      return { type: 'text', text: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', message: `Subagent failed: ${msg}` };
    }
  },
};
