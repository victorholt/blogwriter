'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Check, Share2, ImageOff, Link2, Trash2, FileQuestion } from 'lucide-react';
import Markdown from 'react-markdown';
import { fetchBlog, fetchBlogDebugData, type BlogDetail, type BlogDebugData } from '@/lib/blog-api';
import { createShareLink, deleteSharedBlog, fetchBlogSettings, fetchDebugMode } from '@/lib/api';
import { copyRichText } from '@/lib/copy-utils';
import { useAuthStore } from '@/stores/auth-store';
import Modal from '@/components/ui/Modal';
import CompareDropdown from '@/components/CompareDropdown';
import type { CompareMode } from '@/components/CompareDropdown';
import AgentInsight from '@/components/AgentInsight';
import AgentDiffPanel from '@/components/AgentDiffPanel';
import AttributionOverlay from '@/components/AttributionOverlay';

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

export default function BlogDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const [blog, setBlog] = useState<BlogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  // Debug/compare state (admin only)
  const [debugMode, setDebugMode] = useState(false);
  const [insightsEnabled, setInsightsEnabled] = useState(false);
  const [debugData, setDebugData] = useState<BlogDebugData | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>({ type: 'none' });

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<'confirm' | 'sharing' | 'shared'>('confirm');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareHash, setShareHash] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareDeleting, setShareDeleting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchBlog(params.id as string).then((result) => {
        if (result.success && result.data) {
          setBlog(result.data);
        }
        setLoading(false);
      });
    }
    fetchBlogSettings().then((settings) => {
      setSharingEnabled(settings.sharingEnabled);
    });
  }, [params.id]);

  // Fetch debug data for admins
  useEffect(() => {
    if (!isAdmin || !params.id) return;
    fetchDebugMode().then((result) => {
      setDebugMode(result.debugMode);
      setInsightsEnabled(result.insightsEnabled);
      if (result.debugMode) {
        fetchBlogDebugData(params.id as string).then((res) => {
          if (res.success && res.data) {
            setDebugData(res.data);
          }
        });
      }
    });
  }, [isAdmin, params.id]);

  const compareAgents = debugData?.pipeline.filter((a) => debugData.agentOutputs[a.id]) ?? [];
  const hasMultipleOutputs = compareAgents.length >= 2;

  // Build imageUrl → dress lookup for brand/style labels under images
  const imageUrlToDress = useMemo(() => {
    const map = new Map<string, { designer: string; styleId: string }>();
    if (blog?.dresses) {
      for (const d of blog.dresses) {
        if (d.imageUrl) {
          map.set(d.imageUrl, { designer: d.designer, styleId: d.styleId });
        }
      }
    }
    return map;
  }, [blog?.dresses]);

  const handleImageError = useCallback((src: string) => {
    setBrokenImages((prev) => {
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  // Build clipboard-compatible dress map for copy
  const clipboardDressMap = useMemo(() => {
    const map = new Map<string, { designer?: string; styleId?: string }>();
    for (const [url, info] of imageUrlToDress) {
      map.set(url, { designer: info.designer || undefined, styleId: info.styleId || undefined });
    }
    return map;
  }, [imageUrlToDress]);

  async function handleCopy(): Promise<void> {
    if (!blog?.generatedBlog) return;
    try {
      await copyRichText(blog.generatedBlog, { dressMap: clipboardDressMap });
    } catch { /* fallback handled inside copyRichText */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function openShareModal(): void {
    setShareStatus('confirm');
    setShareUrl(null);
    setShareHash(null);
    setShareCopied(false);
    setShareModalOpen(true);
  }

  async function handleShareConfirm(): Promise<void> {
    if (!blog?.generatedBlog || shareStatus === 'sharing') return;
    setShareStatus('sharing');
    try {
      const result = await createShareLink({
        blogContent: blog.generatedBlog,
        brandName: blog.brandLabelSlug || undefined,
      });
      if (result.success && result.data) {
        const url = `${window.location.origin}/share/${result.data.hash}`;
        setShareUrl(url);
        setShareHash(result.data.hash);
        setShareStatus('shared');
      } else {
        setShareStatus('confirm');
      }
    } catch {
      setShareStatus('confirm');
    }
  }

  async function handleCopyShareUrl(): Promise<void> {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  }

  async function handleDeleteShare(): Promise<void> {
    if (!shareHash || shareDeleting) return;
    setShareDeleting(true);
    try {
      const result = await deleteSharedBlog(shareHash);
      if (result.success) {
        setShareModalOpen(false);
        setShareStatus('confirm');
        setShareUrl(null);
        setShareHash(null);
      }
    } catch { /* ignore */ }
    setShareDeleting(false);
  }

  if (loading) {
    return (
      <div className="blog-detail">
        <div className="blog-detail__loading">
          <div className="blog-dashboard__spinner" />
          <p>Loading blog...</p>
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="status-page">
        <div className="status-page__icon status-page__icon--not-found">
          <FileQuestion size={36} strokeWidth={1.5} />
        </div>
        <h1 className="status-page__title">Blog Not Found</h1>
        <p className="status-page__text">
          This blog may have been deleted or doesn't exist.
        </p>
        <div className="status-page__actions">
          <button className="btn btn--primary" onClick={() => router.push('/my/blogs')}>
            Back to Blogs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-detail">
      {/* Action bar */}
      <div className="result__action-bar">
        <button
          className="result__action-btn"
          onClick={() => router.push('/my/blogs')}
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <div className="result__action-divider" />
        <button
          className={`result__action-btn ${copied ? 'result__action-btn--copied' : ''}`}
          onClick={handleCopy}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
        </button>
        {debugMode && hasMultipleOutputs && (
          <>
            <div className="result__action-divider" />
            <CompareDropdown
              value={compareMode}
              onChange={setCompareMode}
              agents={compareAgents}
            />
          </>
        )}
        {sharingEnabled && (
          <>
            <div className="result__action-divider" />
            <button className="result__action-btn" onClick={openShareModal}>
              <Share2 size={14} />
              <span>Share</span>
            </button>
          </>
        )}
      </div>

      {/* Title */}
      <div className="blog-detail__title-section">
        <h1 className="blog-detail__title">{blog.title || 'Untitled Blog'}</h1>
        <time className="blog-detail__date">
          {new Date(blog.createdAt).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })}
        </time>
      </div>

      {/* Blog content — switches based on compare mode */}
      <div className="result__content">
        {compareMode.type === 'attribution' && blog.generatedBlog && debugData ? (
          <AttributionOverlay
            overrideOutputs={debugData.agentOutputs}
            overridePipeline={debugData.pipeline}
            overrideBlog={blog.generatedBlog}
          />
        ) : compareMode.type === 'diff' && debugData ? (
          <AgentDiffPanel
            leftAgent={compareMode.left}
            rightAgent={compareMode.right}
            overrideOutputs={debugData.agentOutputs}
            overridePipeline={debugData.pipeline}
          />
        ) : blog.generatedBlog ? (
          <Markdown
            components={{
              img: ({ src: rawSrc, alt }) => {
                const src = typeof rawSrc === 'string' ? rawSrc : undefined;
                const isBroken = src ? brokenImages.has(src) : true;
                const dress = src ? imageUrlToDress.get(src) : undefined;

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
                    {dress?.designer || dress?.styleId ? (
                      <span className="result__figure-meta">
                        {dress.designer && (
                          <span className="result__figure-brand">{dress.designer}</span>
                        )}
                        {dress.styleId && (
                          <span className="result__figure-style">{dress.styleId}</span>
                        )}
                      </span>
                    ) : null}
                    {alt && <span className="result__figure-caption">{alt}</span>}
                  </span>
                );
              },
            }}
          >
            {preprocessImages(blog.generatedBlog)}
          </Markdown>
        ) : (
          <div className="blog-detail__empty">
            <p>No content available for this blog.</p>
          </div>
        )}
      </div>

      {/* Agent Insights (admin + debug mode + insights enabled) */}
      {debugMode && insightsEnabled && debugData && Object.keys(debugData.blogTraceIds).length > 0 && (
        <div className="result__insights">
          <h3 className="result__insights-title">Agent Insights</h3>
          {debugData.pipeline
            .filter((a) => debugData.blogTraceIds[a.id])
            .map((agent) => (
              <AgentInsight
                key={agent.id}
                traceId={debugData.blogTraceIds[agent.id]}
                agentId={agent.id}
                agentLabel={agent.label}
                overrideOutputs={debugData.agentOutputs}
                overridePipeline={debugData.pipeline}
              />
            ))}
        </div>
      )}

      {/* Footer */}
      <div className="blog-detail__footer">
        <span className="blog-detail__footer-label">
          {blog.brandLabelSlug || 'Blog post'}
        </span>
        <span className="blog-detail__footer-date">
          {new Date(blog.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </span>
      </div>

      {/* Share Modal */}
      <Modal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={shareStatus === 'shared' ? 'Share Link Created' : 'Share Blog Post'}
      >
        {shareStatus === 'confirm' && (
          <div className="share-modal">
            <p className="share-modal__description">
              Create a public link that anyone can use to read this blog post.
              The shared version is read-only.
            </p>
            <div className="share-modal__actions">
              <button className="btn btn--ghost" onClick={() => setShareModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={handleShareConfirm}>
                <Share2 size={15} />
                Create Share Link
              </button>
            </div>
          </div>
        )}
        {shareStatus === 'sharing' && (
          <div className="share-modal">
            <p className="share-modal__description">Creating share link...</p>
          </div>
        )}
        {shareStatus === 'shared' && shareUrl && (
          <div className="share-modal">
            <p className="share-modal__description">
              Anyone with this link can view the blog post.
            </p>
            <div className="share-modal__url-row">
              <Link2 size={14} className="share-modal__url-icon" />
              <input
                className="share-modal__url-input"
                type="text"
                readOnly
                value={shareUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button className="share-modal__url-copy" onClick={handleCopyShareUrl}>
                {shareCopied ? <Check size={14} /> : <Copy size={14} />}
                {shareCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="share-modal__footer">
              {isAdmin && (
                <button
                  className="share-modal__delete"
                  onClick={handleDeleteShare}
                  disabled={shareDeleting}
                >
                  <Trash2 size={13} />
                  {shareDeleting ? 'Removing...' : 'Remove Share'}
                </button>
              )}
              <button className="btn btn--ghost" onClick={() => setShareModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
