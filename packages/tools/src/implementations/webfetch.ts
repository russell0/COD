import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const WebFetchInputSchema = z.object({
  url: z.string().url().describe('The URL to fetch'),
  prompt: z
    .string()
    .optional()
    .describe('Optional: what information to extract from the page'),
  max_length: z
    .number()
    .int()
    .positive()
    .optional()
    .default(50000)
    .describe('Max characters to return'),
});

type WebFetchInput = z.infer<typeof WebFetchInputSchema>;

/**
 * Convert HTML to plain text / markdown (simple implementation).
 */
function htmlToText(html: string): string {
  return html
    // Remove scripts and styles
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Convert headings
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    // Convert links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Convert line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const WebFetchTool: ToolDefinition<WebFetchInput> = {
  name: 'WebFetch',
  description:
    'Fetch content from a URL and return it as text. Converts HTML to readable markdown.',
  inputSchema: WebFetchInputSchema,
  annotations: { readOnly: true },

  async execute(input: WebFetchInput, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const response = await fetch(input.url, {
        signal: context.signal,
        headers: {
          'User-Agent': 'COD/1.0 (AI coding assistant)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        return {
          type: 'error',
          message: `HTTP ${response.status}: ${response.statusText} — ${input.url}`,
        };
      }

      const contentType = response.headers.get('content-type') ?? '';
      let text: string;

      if (contentType.includes('text/html')) {
        const html = await response.text();
        text = htmlToText(html);
      } else if (contentType.includes('application/json')) {
        const json = await response.json();
        text = JSON.stringify(json, null, 2);
      } else {
        text = await response.text();
      }

      const maxLen = input.max_length ?? 50000;
      if (text.length > maxLen) {
        text = text.slice(0, maxLen) + `\n\n... [truncated at ${maxLen} characters]`;
      }

      return { type: 'text', text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', message: `Failed to fetch URL: ${msg}` };
    }
  },
};
