import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const WebSearchInputSchema = z.object({
  query: z.string().describe('The search query'),
  num_results: z
    .number()
    .int()
    .positive()
    .optional()
    .default(3)
    .describe('Number of results to return (default 3, max 5)'),
  fetch_content: z
    .boolean()
    .optional()
    .default(true)
    .describe('Fetch and include the actual page content of the top results (default true)'),
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
 * Convert HTML to readable plain text with some structure preserved.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Fetch a page and return its text content, truncated.
 */
async function fetchPageContent(
  url: string,
  maxChars: number,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const response = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'COD/1.0 (AI coding assistant)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!response.ok) return `[HTTP ${response.status}]`;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
      const html = await response.text();
      let text = htmlToText(html);
      if (text.length > maxChars) {
        text = text.slice(0, maxChars) + '\n[truncated]';
      }
      return text;
    } else if (contentType.includes('application/json')) {
      const json = await response.json();
      let text = JSON.stringify(json, null, 2);
      if (text.length > maxChars) {
        text = text.slice(0, maxChars) + '\n[truncated]';
      }
      return text;
    }
    let text = await response.text();
    if (text.length > maxChars) {
      text = text.slice(0, maxChars) + '\n[truncated]';
    }
    return text;
  } catch {
    return '[failed to fetch page]';
  }
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

  const resultBlocks = html.split(/class="result\s/g).slice(1);

  for (const block of resultBlocks) {
    if (results.length >= numResults) break;

    const urlMatch = block.match(/href="\/\/duckduckgo\.com\/l\/\?uddg=([^&"]+)/);
    const directUrlMatch = block.match(/class="result__url"[^>]*href="([^"]+)"/);
    let url = '';
    if (urlMatch && urlMatch[1]) {
      url = decodeURIComponent(urlMatch[1]);
    } else if (directUrlMatch && directUrlMatch[1]) {
      url = directUrlMatch[1];
      if (url.startsWith('//')) url = 'https:' + url;
    }

    const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const title = titleMatch && titleMatch[1] ? stripHtml(titleMatch[1]) : '';

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
    'Search the web and return results with full page content. ' +
    'Searches via DuckDuckGo (no API key needed), then fetches and reads ' +
    'the actual pages so you can answer questions with real data. ' +
    'Use this whenever you need current information from the internet.',
  inputSchema: WebSearchInputSchema,
  annotations: { readOnly: true },

  async execute(input: WebSearchInput, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const numResults = Math.min(input.num_results ?? 3, 5);
      const shouldFetch = input.fetch_content ?? true;
      const results = await searchDuckDuckGo(input.query, numResults, context.signal);

      if (results.length === 0) {
        return { type: 'text', text: `No results found for: "${input.query}"` };
      }

      // Fetch actual page content for each result in parallel.
      const maxCharsPerPage = Math.floor(30000 / numResults);
      let sections: string[];

      if (shouldFetch) {
        const pages = await Promise.all(
          results.map((r) => fetchPageContent(r.url, maxCharsPerPage, context.signal)),
        );
        sections = results.map((r, i) => {
          const pageContent = pages[i] ?? '[no content]';
          return (
            `## ${i + 1}. ${r.title}\n` +
            `URL: ${r.url}\n\n` +
            `${pageContent}`
          );
        });
      } else {
        sections = results.map((r, i) =>
          `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`,
        );
      }

      return {
        type: 'text',
        text: `Search results for "${input.query}":\n\n${sections.join('\n\n---\n\n')}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', text: `Web search failed: ${msg}` };
    }
  },
};
