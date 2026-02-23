import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

// In-memory todo store (per session)
const todoStore = new Map<string, TodoItem[]>();

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

const TodoItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high']),
});

const TodoWriteInputSchema = z.object({
  todos: z.array(TodoItemSchema).describe('The complete list of todos to save'),
});

const TodoReadInputSchema = z.object({});

type TodoWriteInput = z.infer<typeof TodoWriteInputSchema>;
type TodoReadInput = z.infer<typeof TodoReadInputSchema>;

export const TodoWriteTool: ToolDefinition<TodoWriteInput> = {
  name: 'TodoWrite',
  description:
    'Write/update the todo list for the current session. Replaces the entire list.',
  inputSchema: TodoWriteInputSchema,
  annotations: { readOnly: false },

  async execute(input: TodoWriteInput, context: ToolExecutionContext): Promise<ToolResult> {
    todoStore.set(context.sessionId, input.todos);
    return {
      type: 'text',
      text: `Saved ${input.todos.length} todo item(s).`,
    };
  },
};

export const TodoReadTool: ToolDefinition<TodoReadInput> = {
  name: 'TodoRead',
  description: 'Read the current todo list for this session.',
  inputSchema: TodoReadInputSchema,
  annotations: { readOnly: true },

  async execute(_input: TodoReadInput, context: ToolExecutionContext): Promise<ToolResult> {
    const todos = todoStore.get(context.sessionId) ?? [];

    if (todos.length === 0) {
      return { type: 'text', text: 'No todos yet.' };
    }

    const lines = todos.map((t) => {
      const statusIcon =
        t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : '○';
      const priorityTag = t.priority !== 'medium' ? ` [${t.priority}]` : '';
      return `${statusIcon} [${t.id}] ${t.content}${priorityTag}`;
    });

    return { type: 'text', text: lines.join('\n') };
  },
};
