import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const WebSearchInputSchema = z.object({
  query: z.string().describe('The search query'),
  num_results: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5)
    .describe('Number of results to return (default 5, max 10)'),
});

type WebSearchInput = z.infer<typeof WebSearchInputSchema>;

/**
 * Extract text content from HTML, stripping tags.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search the web using DuckDuckGo's HTML interface (no API key needed).
 */
async function searchDuckDuckGo(
  query: string,
  numResults: number,
  signal?: AbortSignal,
): Promise<{ title: string; url: string; snippet: string }[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
    signal,
    headers: {
      'User-Agent': 'COD/1.0 (AI coding assistant)',
      'Accept': 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const results: { title: string; url: string; snippet: string }[] = [];

  // Parse DuckDuckGo HTML results.
  // Each result is in a <div class="result"> with:
  //   <a class="result__a" href="...">title</a>
  //   <a class="result__snippet">snippet</a>
  const resultBlocks = html.split(/class="result\s/g).slice(1);

  for (const block of resultBlocks) {
    if (results.length >= numResults) break;

    // Extract URL — DuckDuckGo wraps URLs in a redirect, the actual URL is
    // in the result__url span or decoded from the uddg= parameter.
    const urlMatch = block.match(/href="\/\/duckduckgo\.com\/l\/\?uddg=([^&"]+)/);
    const directUrlMatch = block.match(/class="result__url"[^>]*href="([^"]+)"/);
    let url = '';
    if (urlMatch && urlMatch[1]) {
      url = decodeURIComponent(urlMatch[1]);
    } else if (directUrlMatch && directUrlMatch[1]) {
      url = directUrlMatch[1];
      if (url.startsWith('//')) url = 'https:' + url;
    }

    // Extract title
    const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const title = titleMatch && titleMatch[1] ? stripHtml(titleMatch[1]) : '';

    // Extract snippet
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const snippet = snippetMatch && snippetMatch[1] ? stripHtml(snippetMatch[1]) : '';

    if (url && title) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

export const WebSearchTool: ToolDefinition<WebSearchInput> = {
  name: 'WebSearch',
  description:
    'Search the web and return results with titles, URLs, and snippets. ' +
    'Uses DuckDuckGo — no API key required. Use this to find current ' +
    'information, documentation, or answers to questions about the world.',
  inputSchema: WebSearchInputSchema,
  annotations: { readOnly: true },

  async execute(input: WebSearchInput, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const numResults = Math.min(input.num_results ?? 5, 10);
      const results = await searchDuckDuckGo(input.query, numResults, context.signal);

      if (results.length === 0) {
        return { type: 'text', text: `No results found for: "${input.query}"` };
      }

      const formatted = results
        .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
        .join('\n\n');

      return {
        type: 'text',
        text: `Search results for "${input.query}":\n\n${formatted}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', text: `Web search failed: ${msg}` };
    }
  },
};
