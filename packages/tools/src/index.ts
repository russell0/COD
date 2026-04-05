export * from './registry.js';
export * from './zod-to-json.js';
export * from './implementations/read.js';
export * from './implementations/glob.js';
export * from './implementations/grep.js';
export * from './implementations/write.js';
export * from './implementations/edit.js';
export * from './implementations/bash.js';
export * from './implementations/webfetch.js';
export * from './implementations/todo.js';
export * from './implementations/task.js';
export * from './implementations/websearch.js';

import { ToolRegistry } from './registry.js';
import { ReadTool } from './implementations/read.js';
import { GlobTool } from './implementations/glob.js';
import { GrepTool } from './implementations/grep.js';
import { WriteTool } from './implementations/write.js';
import { EditTool, MultiEditTool } from './implementations/edit.js';
import { BashTool } from './implementations/bash.js';
import { WebFetchTool } from './implementations/webfetch.js';
import { WebSearchTool } from './implementations/websearch.js';
import { TodoWriteTool, TodoReadTool } from './implementations/todo.js';
import { TaskTool } from './implementations/task.js';

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.registerAll([
    ReadTool,
    GlobTool,
    GrepTool,
    WriteTool,
    EditTool,
    MultiEditTool,
    BashTool,
    WebFetchTool,
    WebSearchTool,
    TodoWriteTool,
    TodoReadTool,
    TaskTool,
  ]);
  return registry;
}
