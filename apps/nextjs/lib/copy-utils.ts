import { marked } from 'marked';

/**
 * Convert markdown to clean HTML suitable for pasting into
 * WYSIWYG editors (Google Docs, WordPress, Squarespace, etc.).
 *
 * - Uses simple inline styles that editors universally support
 * - Replaces images with a small italic placeholder line
 * - No floats, no flex, no background colors — just clean rich text
 */
export function markdownToClipboardHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;

  // Replace <img> tags with a simple italic placeholder line.
  // WYSIWYG editors handle basic text much better than styled divs.
  let imgIndex = 0;
  const html = rawHtml.replace(
    /<img\s+[^>]*?alt=["']([^"']*)["'][^>]*?\/?>/gi,
    (_match, alt: string) => {
      imgIndex++;
      const label = alt || 'Image';
      return `<p style="color:#999;font-style:italic;font-size:14px;margin:1em 0;">[Insert image: ${label}]</p>`;
    },
  );

  // Catch remaining <img> tags without alt
  const cleaned = html.replace(
    /<img\s+[^>]*?\/?>/gi,
    () => {
      imgIndex++;
      return `<p style="color:#999;font-style:italic;font-size:14px;margin:1em 0;">[Insert image here]</p>`;
    },
  );

  return cleaned;
}

/**
 * Fallback copy using a temporary element and execCommand.
 * Works in non-secure contexts (HTTP) where clipboard API is unavailable.
 */
function fallbackCopyRichText(html: string): void {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.opacity = '0';
  document.body.appendChild(container);

  const range = document.createRange();
  range.selectNodeContents(container);
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }

  document.execCommand('copy');

  if (selection) {
    selection.removeAllRanges();
  }
  document.body.removeChild(container);
}

/**
 * Copy blog content as rich text to clipboard.
 * Writes both text/html and text/plain so paste targets
 * get the best format they support.
 */
export async function copyRichText(markdown: string): Promise<void> {
  const html = markdownToClipboardHtml(markdown);

  // Try modern ClipboardItem API for rich text (requires secure context)
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([markdown], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);
      return;
    }
  } catch {
    // ClipboardItem failed (likely non-secure context), fall through
  }

  // Try writeText as second option
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(markdown);
      return;
    }
  } catch {
    // writeText also failed, fall through
  }

  // Final fallback: execCommand with rich text
  fallbackCopyRichText(html);
}
