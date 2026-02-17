import { marked } from 'marked';

/**
 * Convert markdown to clean HTML suitable for pasting into
 * WYSIWYG editors (Google Docs, WordPress, Squarespace, etc.).
 *
 * - Uses simple inline styles that editors universally support
 * - Replaces images with a small italic placeholder line
 * - No floats, no flex, no background colors — just clean rich text
 */
export interface ClipboardDressInfo {
  designer?: string;
  styleId?: string;
}

/** Fallback: convert slugs like "sorella-dress" to "Sorella Dress" */
function formatBrandSlug(raw: string): string {
  return raw
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function markdownToClipboardHtml(
  markdown: string,
  options?: {
    includeImages?: boolean;
    dressMap?: Map<string, ClipboardDressInfo>;
    brandLabelMap?: Map<string, string>;
  },
): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;

  // When including images, extract every <img> out of its surrounding
  // paragraph so it becomes a standalone block element — matching
  // the blog preview where images always sit on their own line.
  //
  // The Blog Writer agent often places images inline with text, so
  // marked outputs `<p>text <img .../> more text</p>`. We close the
  // <p> before the image and reopen it after, then clean up empties.
  //
  // Uses align="center" (HTML attribute) instead of CSS margin:auto
  // for maximum compatibility across WYSIWYG editors.
  if (options?.includeImages) {
    const dressMap = options.dressMap;
    const brandLabelMap = options.brandLabelMap;

    // Replace every <img> with: close </p> + image block + reopen <p>
    let html = rawHtml.replace(
      /<img\s+([^>]*?)\/?>/gi,
      (_match, attrs: string) => {
        const srcMatch = attrs.match(/src=["']([^"']*?)["']/i);
        const altMatch = attrs.match(/alt=["']([^"']*?)["']/i);
        const src = srcMatch?.[1] || '';
        const caption = altMatch?.[1] || '';
        const dress = dressMap?.get(src);

        let out = '</p>';  // close surrounding <p>

        // Centered image in its own paragraph
        out += `<p align="center" style="text-align:center;margin:1.5em 0 0 0;">`;
        out += `<img ${attrs} style="display:inline-block;max-width:600px;width:100%;height:auto;border-radius:8px;" />`;
        out += `</p>`;

        // Brand + style row
        if (dress?.designer || dress?.styleId) {
          const parts: string[] = [];
          if (dress.designer) {
            const displayName = brandLabelMap?.get(dress.designer) || formatBrandSlug(dress.designer);
            parts.push(`<strong style="font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#374151;">${displayName}</strong>`);
          }
          if (dress.styleId) {
            parts.push(`<span style="color:#9ca3af;">${dress.styleId}</span>`);
          }
          out += `<p align="center" style="font-size:11px;text-align:center;margin:3px 0 0 0;">${parts.join(' &middot; ')}</p>`;
        }

        // Caption (italic description)
        if (caption) {
          out += `<p align="center" style="font-size:11px;font-style:italic;color:#9ca3af;text-align:center;margin:2px 0 1.5em 0;">${caption}</p>`;
        } else {
          out += `<p style="margin:0 0 1.5em 0;">&nbsp;</p>`;
        }

        out += '<p>';  // reopen <p> for any text that follows
        return out;
      },
    );

    // Clean up empty <p></p> tags left behind
    html = html.replace(/<p>\s*<\/p>/gi, '');

    return html;
  }

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
export async function copyRichText(
  markdown: string,
  options?: { includeImages?: boolean; dressMap?: Map<string, ClipboardDressInfo>; brandLabelMap?: Map<string, string> },
): Promise<void> {
  const html = markdownToClipboardHtml(markdown, options);

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
