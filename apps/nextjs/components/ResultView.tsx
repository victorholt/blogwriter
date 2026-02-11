'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { Copy, Check, RotateCcw, Star, AlertTriangle, ChevronDown, Search, ImageOff, Image } from 'lucide-react';
import Markdown from 'react-markdown';
import AgentInsight from '@/components/AgentInsight';
import AgentDiffPanel from '@/components/AgentDiffPanel';
import AttributionOverlay from '@/components/AttributionOverlay';
import CompareDropdown from '@/components/CompareDropdown';
import type { CompareMode } from '@/components/CompareDropdown';
import { copyRichText } from '@/lib/copy-utils';
import { fetchDebugMode } from '@/lib/api';

/**
 * Preprocess markdown to convert bracket placeholders and real links
 * into a format we can highlight in the renderer.
 *
 * Converts: [INTERNAL_LINK: schedule your bridal appointment]
 * Into:     [schedule your bridal appointment](placeholder:internal_link)
 *
 * Real markdown links [text](url) are left as-is (the custom `a` renderer handles them).
 */
function preprocessLinks(markdown: string): string {
  return markdown.replace(
    /\[([A-Z][A-Z_]+):\s*([^\]]+)\](?!\()/g,
    (_match, label: string, text: string) =>
      `[${text.trim()}](placeholder:${label.toLowerCase()})`,
  );
}

/**
 * Fix broken image markdown that agents may produce when editing text
 * around inline images. Uses a placeholder strategy to avoid re-matching:
 *
 * Step 1: Protect existing valid ![alt](url) with placeholders
 * Step 2: Fix [alt](image-url) missing "!" prefix
 * Step 3: Fix orphaned ](image-url) where ![alt was completely stripped
 * Step 4: Restore all placeholders
 */
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif|svg)(\?[^\s)]*)?$/i;
const IMAGE_CDNS = /cdn\.(essensedesigns|maggie|maggiesottero|sotteroandmidgley|morilee|allurebridals|justinalexander)\./i;

function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSIONS.test(url) || IMAGE_CDNS.test(url);
}

function preprocessImages(markdown: string): string {
  const placeholders: string[] = [];

  // Step 1: Protect existing valid ![alt](url) with placeholders
  let result = markdown.replace(/!\[[^\]]*\]\([^)]+\)/g, (match) => {
    placeholders.push(match);
    return `__IMGPH_${placeholders.length - 1}__`;
  });

  // Step 2: [alt](image-url) missing "!" prefix → convert to image
  result = result.replace(
    /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    (match, alt: string, url: string) => {
      if (!isImageUrl(url)) return match;
      const img = `![${alt}](${url})`;
      placeholders.push(img);
      return `\n\n__IMGPH_${placeholders.length - 1}__\n\n`;
    },
  );

  // Step 3: Orphaned ](image-url) where ![alt was completely stripped.
  // After steps 1–2, any remaining ](image-url) is guaranteed orphaned.
  // Replace just the ](url) with a proper image; leftover text stays as-is.
  result = result.replace(
    /\]\((https?:\/\/[^)]+)\)/g,
    (match, url: string) => {
      if (!isImageUrl(url)) return match;
      const img = `![](${url})`;
      placeholders.push(img);
      return `\n\n__IMGPH_${placeholders.length - 1}__\n\n`;
    },
  );

  // Step 4: Restore all placeholders
  result = result.replace(/__IMGPH_(\d+)__/g, (_, i) => placeholders[parseInt(i)]);

  // Collapse runs of 3+ newlines
  return result.replace(/\n{3,}/g, '\n\n');
}

/** Convert slugs like "sorella-dress" to "Sorella Dress" */
function formatBrandName(raw: string): string {
  return raw
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ResultView(): React.ReactElement {
  const generatedBlog = useWizardStore((s) => s.generatedBlog);
  const seoMetadata = useWizardStore((s) => s.seoMetadata);
  const review = useWizardStore((s) => s.review);
  const reset = useWizardStore((s) => s.reset);
  const blogTraceIds = useWizardStore((s) => s.blogTraceIds);
  const agentOutputs = useWizardStore((s) => s.agentOutputs);
  const generationPipeline = useWizardStore((s) => s.generationPipeline);
  const debugMode = useWizardStore((s) => s.debugMode);
  const setDebugMode = useWizardStore((s) => s.setDebugMode);
  const dressesMap = useWizardStore((s) => s.dressesMap);
  const generateImages = useWizardStore((s) => s.generateImages);

  // Re-fetch debug mode on mount so changes made in admin since page load take effect
  useEffect(() => {
    fetchDebugMode().then((result) => setDebugMode(result.debugMode));
  }, [setDebugMode]);

  // Build imageUrl → Dress lookup for structured captions
  const imageUrlToDress = useMemo(() => {
    const map = new Map<string, { designer?: string; styleId?: string; alt?: string }>();
    for (const dress of dressesMap.values()) {
      if (dress.imageUrl) {
        map.set(dress.imageUrl, {
          designer: dress.designer,
          styleId: dress.styleId,
          alt: dress.name,
        });
      }
    }
    return map;
  }, [dressesMap]);

  const [copied, setCopied] = useState(false);
  const [includeImages, setIncludeImages] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('blogwriter:includeImages') === 'true';
  });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>({ type: 'none' });

  // Persist includeImages to localStorage; force off when debug mode is disabled
  useEffect(() => {
    if (!debugMode) {
      setIncludeImages(false);
      return;
    }
    localStorage.setItem('blogwriter:includeImages', String(includeImages));
  }, [includeImages, debugMode]);

  // Agents that have stored outputs (for the compare dropdown)
  // Use pipeline order if available, fall back to known agent order
  const AGENT_ORDER = ['blog-writer', 'blog-editor', 'seo-specialist', 'senior-editor', 'blog-reviewer'];
  const AGENT_LABELS: Record<string, string> = {
    'blog-writer': 'Blog Writer',
    'blog-editor': 'Blog Editor',
    'seo-specialist': 'SEO Specialist',
    'senior-editor': 'Senior Editor',
    'blog-reviewer': 'Blog Reviewer',
  };
  const compareAgents = generationPipeline.length > 0
    ? generationPipeline.filter((a) => agentOutputs[a.id])
    : AGENT_ORDER
        .filter((id) => agentOutputs[id])
        .map((id) => ({ id, label: AGENT_LABELS[id] || id }));
  const hasMultipleOutputs = compareAgents.length >= 2;

  async function handleCopy(): Promise<void> {
    if (!generatedBlog) return;
    try {
      await copyRichText(generatedBlog, { includeImages, dressMap: imageUrlToDress });
    } catch {
      // Fallback already handled inside copyRichText
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function getScoreColor(score: number): string {
    if (score >= 8) return 'var(--color-green)';
    if (score >= 6) return 'var(--color-yellow, #f59e0b)';
    return 'var(--color-red, #ef4444)';
  }

  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const handleImageError = useCallback((src: string) => {
    setBrokenImages((prev) => {
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  return (
    <div className="page-shell">
      <div className="paper result">
        {/* Top action bar */}
        <div className="result__action-bar">
          <button
            className={`result__action-btn ${copied ? 'result__action-btn--copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>
          {debugMode && generateImages && (
            <>
              <div className="result__action-divider" />
              <button
                className={`result__action-btn ${includeImages ? 'result__action-btn--active' : ''}`}
                onClick={() => setIncludeImages(!includeImages)}
                title={includeImages ? 'Images will be included when copying' : 'Images excluded from copy'}
              >
                {includeImages ? <Image size={14} /> : <ImageOff size={14} />}
                <span>{includeImages ? 'Images On' : 'Images Off'}</span>
              </button>
            </>
          )}
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
          <div className="result__action-divider" />
          <button className="result__action-btn" onClick={reset}>
            <RotateCcw size={14} />
            <span>Start Over</span>
          </button>
        </div>

        {/* Blog Content — switches based on compare mode */}
        <div className="result__content">
          {compareMode.type === 'attribution' && generatedBlog ? (
            <AttributionOverlay />
          ) : compareMode.type === 'diff' ? (
            <AgentDiffPanel
              leftAgent={compareMode.left}
              rightAgent={compareMode.right}
            />
          ) : generatedBlog ? (
            <Markdown
              components={{
                img: ({ src, alt }) => {
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
                            <span className="result__figure-brand">{formatBrandName(dress.designer)}</span>
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
                a: ({ href, children }) => {
                  const isPlaceholder = href?.startsWith('placeholder:');

                  return (
                    <span className={`result__link ${isPlaceholder ? 'result__link--placeholder' : ''}`}>
                      {children}
                      <span className="result__link-badge">{isPlaceholder ? 'needs link' : 'ai generated'}</span>
                    </span>
                  );
                },
                p: ({ children }) => {
                  // Detect image-only paragraphs and render as a grid block
                  const childArray = React.Children.toArray(children);
                  const meaningful = childArray.filter(
                    (child) => !(typeof child === 'string' && child.trim() === ''),
                  );
                  const imageCount = meaningful.filter(
                    (child) =>
                      React.isValidElement(child) &&
                      typeof child.props === 'object' &&
                      child.props !== null &&
                      'data-figure' in child.props,
                  ).length;

                  if (imageCount > 0 && imageCount === meaningful.length) {
                    const count = Math.min(imageCount, 4);
                    return (
                      <div className={`result__image-block result__image-block--${count}`}>
                        {children}
                      </div>
                    );
                  }
                  return <p>{children}</p>;
                },
              }}
            >
              {preprocessLinks(preprocessImages(generatedBlog))}
            </Markdown>
          ) : (
            <p className="result__empty">No blog content generated.</p>
          )}
        </div>

        {/* Collapsible Panels */}
        <div className="result__panels">
          {/* Review Panel */}
          {review && (
            <div className={`result__panel ${reviewOpen ? 'result__panel--open' : ''}`}>
              <button
                type="button"
                className="result__panel-header"
                onClick={() => setReviewOpen(!reviewOpen)}
              >
                <div className="result__panel-header-left">
                  <Star size={16} style={{ color: getScoreColor(review.qualityScore) }} />
                  <span className="result__panel-title">Quality Review</span>
                  <span
                    className="result__panel-badge"
                    style={{ background: getScoreColor(review.qualityScore) }}
                  >
                    {review.qualityScore}/10
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`result__panel-chevron ${reviewOpen ? 'result__panel-chevron--open' : ''}`}
                />
              </button>

              {reviewOpen && (
                <div className="result__panel-body">
                  {review.strengths.length > 0 && (
                    <div className="result__review-section">
                      <h4 className="result__review-heading">Strengths</h4>
                      <ul className="result__review-list">
                        {review.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  {review.suggestions.length > 0 && (
                    <div className="result__review-section">
                      <h4 className="result__review-heading">Suggestions</h4>
                      <ul className="result__review-list result__review-list--suggestions">
                        {review.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  {review.flags.length > 0 && (
                    <div className="result__review-section">
                      <h4 className="result__review-heading">
                        <AlertTriangle size={14} />
                        Flags
                      </h4>
                      <ul className="result__review-list result__review-list--flags">
                        {review.flags.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SEO Panel */}
          {seoMetadata && (
            <div className={`result__panel ${seoOpen ? 'result__panel--open' : ''}`}>
              <button
                type="button"
                className="result__panel-header"
                onClick={() => setSeoOpen(!seoOpen)}
              >
                <div className="result__panel-header-left">
                  <Search size={16} />
                  <span className="result__panel-title">SEO Metadata</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`result__panel-chevron ${seoOpen ? 'result__panel-chevron--open' : ''}`}
                />
              </button>

              {seoOpen && (
                <div className="result__panel-body">
                  <div className="result__seo-fields">
                    <div className="result__seo-field">
                      <span className="result__seo-label">Title</span>
                      <span className="result__seo-value">{seoMetadata.title}</span>
                    </div>
                    <div className="result__seo-field">
                      <span className="result__seo-label">Description</span>
                      <span className="result__seo-value">{seoMetadata.description}</span>
                    </div>
                    {seoMetadata.keywords.length > 0 && (
                      <div className="result__seo-field">
                        <span className="result__seo-label">Keywords</span>
                        <div className="result__seo-keywords">
                          {seoMetadata.keywords.map((kw, i) => (
                            <span key={i} className="result__seo-keyword">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Agent Insights (only visible in debug mode) */}
        {debugMode && Object.keys(blogTraceIds).length > 0 && (
          <div className="result__insights">
            <h3 className="result__insights-title">Agent Insights</h3>
            {Object.entries(blogTraceIds).map(([agentId, traceId]) => (
              <AgentInsight
                key={agentId}
                traceId={traceId}
                agentLabel={agentId.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
