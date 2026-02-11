'use client';

import { useState, useCallback, useRef } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { Copy, Check, RotateCcw, Star, AlertTriangle, ChevronDown, Search, ImageOff } from 'lucide-react';
import Markdown from 'react-markdown';
import AgentInsight from '@/components/AgentInsight';
import AgentDiffPanel from '@/components/AgentDiffPanel';
import AttributionOverlay from '@/components/AttributionOverlay';
import CompareDropdown from '@/components/CompareDropdown';
import type { CompareMode } from '@/components/CompareDropdown';
import { copyRichText } from '@/lib/copy-utils';

export default function ResultView(): React.ReactElement {
  const generatedBlog = useWizardStore((s) => s.generatedBlog);
  const seoMetadata = useWizardStore((s) => s.seoMetadata);
  const review = useWizardStore((s) => s.review);
  const reset = useWizardStore((s) => s.reset);
  const blogTraceIds = useWizardStore((s) => s.blogTraceIds);
  const agentOutputs = useWizardStore((s) => s.agentOutputs);
  const generationPipeline = useWizardStore((s) => s.generationPipeline);
  const debugMode = useWizardStore((s) => s.debugMode);

  const [copied, setCopied] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>({ type: 'none' });

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
      await copyRichText(generatedBlog);
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
  const imageIndexRef = useRef(0);

  const handleImageError = useCallback((src: string) => {
    setBrokenImages((prev) => {
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  // Reset image counter each render so it's consistent
  imageIndexRef.current = 0;

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
                  const idx = imageIndexRef.current++;
                  const side = idx % 2 === 0 ? 'right' : 'left';
                  const isBroken = src ? brokenImages.has(src) : true;
                  return (
                    <span className={`result__figure result__figure--${side}`}>
                      {isBroken ? (
                        <span className="result__figure-placeholder">
                          <ImageOff size={24} />
                          <span>{alt || 'Image'}</span>
                        </span>
                      ) : (
                        <img
                          src={src}
                          alt={alt || ''}
                          width={260}
                          height={350}
                          onError={() => src && handleImageError(src)}
                        />
                      )}
                      {alt && <span className="result__figure-caption">{alt}</span>}
                    </span>
                  );
                },
              }}
            >
              {generatedBlog}
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
