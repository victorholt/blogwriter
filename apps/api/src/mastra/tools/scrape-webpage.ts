import { createTool } from '@mastra/core';
import { z } from 'zod';
import * as cheerio from 'cheerio';

export const scrapeWebpage = createTool({
  id: 'scrape-webpage',
  description: 'Fetches a webpage URL and returns cleaned text content for analysis. Returns an error field if the page could not be fetched.',
  inputSchema: z.object({
    url: z.string().url(),
  }),
  outputSchema: z.object({
    title: z.string(),
    text: z.string(),
    metaDescription: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const response = await fetch(context.url, {
        signal: AbortSignal.timeout(10_000),
        headers: {
          'User-Agent': 'Blogwriter/1.0 (Brand Analysis)',
          Accept: 'text/html',
        },
      });

      if (!response.ok) {
        return { title: '', text: '', error: `HTTP ${response.status} ${response.statusText}` };
      }

      const html = await response.text();
      const $ = cheerio.load(html.slice(0, 100_000)); // Limit to 100KB

      // Remove non-content elements
      $('script, style, nav, footer, header, iframe, noscript, svg').remove();

      const title = $('title').text().trim();
      const metaDescription =
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        '';
      const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8_000);

      return { title, text, metaDescription };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { title: '', text: '', error: message };
    }
  },
});
