import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: [
    '@cod/types',
    '@cod/config',
    '@cod/llm',
    '@cod/tools',
    '@cod/permissions',
    '@cod/hooks',
    '@cod/mcp',
    '@cod/memory',
    '@cod/session',
    '@cod/agent',
    '@cod/tui',
  ],
  // External runtime dependencies shipped to users
  external: [
    'commander',
    'ink',
    'react',
    'zod',
    'execa',
    '@anthropic-ai/sdk',
    'openai',
    '@google/generative-ai',
    '@modelcontextprotocol/sdk',
    'react-devtools-core',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.jsxImportSource = 'react';
  },
});
