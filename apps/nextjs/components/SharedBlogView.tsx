'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Trash2, ImageOff } from 'lucide-react';
import Markdown from 'react-markdown';
import { fetchSharedBlog, deleteSharedBlog } from '@/lib/api';
import { copyRichText } from '@/lib/copy-utils';
import { useAuthStore } from '@/stores/auth-store';
import type { SharedBlog } from '@/types';

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif|svg)(\?[^\s)]*)?$/i;
const IMAGE_CDNS = /cdn\.(essensedesigns|maggie|maggiesottero|sotteroandmidgley|morilee|allurebridals|justinalexander)\./i;

function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSIONS.test(url) || IMAGE_CDNS.test(url);
}

function preprocessImages(markdown: string): string {
  const placeholders: string[] = [];
  let result = markdown.replace(/!\[[^\]]*\]\([^)]+\)/g, (match) => {
    placeholders.push(match);
    return `__IMGPH_${placeholders.length - 1}__`;
  });
  result = result.replace(
    /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    (match, alt: string, url: string) => {
      if (!isImageUrl(url)) return match;
      const img = `![${alt}](${url})`;
      placeholders.push(img);
      return `\n\n__IMGPH_${placeholders.length - 1}__\n\n`;
    },
  );
  result = result.replace(
    /\]\((https?:\/\/[^)]+)\)/g,
    (match, url: string) => {
      if (!isImageUrl(url)) return match;
      const img = `![](${url})`;
      placeholders.push(img);
      return `\n\n__IMGPH_${placeholders.length - 1}__\n\n`;
    },
  );
  result = result.replace(/__IMGPH_(\d+)__/g, (_, i) => placeholders[parseInt(i)]);
  return result.replace(/\n{3,}/g, '\n\n');
}

interface SharedBlogViewProps {
  hash: string;
}

export default function SharedBlogView({ hash }: SharedBlogViewProps): React.ReactElement {
  const [blog, setBlog] = useState<SharedBlog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const { isAuthenticated, user } = useAuthStore();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  useEffect(() => {
    fetchSharedBlog(hash).then((result) => {
      if (result.success && result.data) {
        setBlog(result.data);
      } else {
        setError(result.error || 'Shared blog not found');
      }
      setLoading(false);
    }).catch(() => {
      setError('Failed to load shared blog');
      setLoading(false);
    });
  }, [hash]);

  const handleImageError = useCallback((src: string) => {
    setBrokenImages((prev) => {
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  async function handleCopy(): Promise<void> {
    if (!blog) return;
    try {
      await copyRichText(blog.blogContent);
    } catch {
      // Fallback handled inside copyRichText
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleDelete(): Promise<void> {
    if (!isAdmin || deleting) return;
    if (!confirm('Delete this shared blog? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const result = await deleteSharedBlog(hash);
      if (result.success) {
        setDeleted(true);
      }
    } catch {
      // Ignore
    }
    setDeleting(false);
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="paper shared-blog">
          <div className="shared-blog__loading">Loading shared blog...</div>
        </div>
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="page-shell">
        <div className="paper shared-blog">
          <div className="shared-blog__deleted">
            <h2>Shared blog deleted</h2>
            <p>This share link is no longer active.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="page-shell">
        <div className="paper shared-blog">
          <div className="shared-blog__error">
            <h2>Not Found</h2>
            <p>{error || 'This shared blog does not exist or has been removed.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="paper shared-blog">
        {/* Action bar */}
        <div className="result__action-bar">
          <button
            className={`result__action-btn ${copied ? 'result__action-btn--copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>
          {isAdmin && (
            <>
              <div className="result__action-divider" />
              <button
                className="result__action-btn result__action-btn--danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 size={14} />
                <span>{deleting ? 'Deleting...' : 'Delete Share'}</span>
              </button>
            </>
          )}
        </div>

        {/* Blog content */}
        <div className="result__content">
          <Markdown
            components={{
              img: ({ src: rawSrc, alt }) => {
                const src = typeof rawSrc === 'string' ? rawSrc : undefined;
                const isBroken = src ? brokenImages.has(src) : true;

                return (
                  <span className="result__figure" data-figure="true">
                    {isBroken ? (
                      <span className="result__figure-placeholder">
                        <ImageOff size={24} />
                        <span>{alt || 'Image'}</span>
                      </span>
                    ) : (
                      <img
                        src={src}
                        alt={alt || ''}
                        onError={() => src && handleImageError(src)}
                      />
                    )}
                    {alt && <span className="result__figure-caption">{alt}</span>}
                  </span>
                );
              },
            }}
          >
            {preprocessImages(blog.blogContent)}
          </Markdown>
        </div>

        {/* Footer */}
        <div className="shared-blog__footer">
          <span className="shared-blog__footer-label">
            {blog.brandName ? `Shared from ${blog.brandName}` : 'Shared blog post'}
          </span>
          <span className="shared-blog__footer-date">
            {new Date(blog.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
