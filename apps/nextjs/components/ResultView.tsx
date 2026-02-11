'use client';

import { useState } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { Copy, Check, RotateCcw, Star, AlertTriangle, ChevronDown, Search } from 'lucide-react';
import Markdown from 'react-markdown';

export default function ResultView(): React.ReactElement {
  const generatedBlog = useWizardStore((s) => s.generatedBlog);
  const seoMetadata = useWizardStore((s) => s.seoMetadata);
  const review = useWizardStore((s) => s.review);
  const reset = useWizardStore((s) => s.reset);

  const [copied, setCopied] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);

  async function handleCopy(): Promise<void> {
    if (!generatedBlog) return;
    await navigator.clipboard.writeText(generatedBlog);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getScoreColor(score: number): string {
    if (score >= 8) return 'var(--color-green)';
    if (score >= 6) return 'var(--color-yellow, #f59e0b)';
    return 'var(--color-red, #ef4444)';
  }

  const blogTitle = seoMetadata?.title || 'Your Blog Post';

  return (
    <div className="page-shell">
      <div className="paper result">
        {/* Header */}
        <div className="result__header">
          <div className="result__header-text">
            <h1 className="result__title">{blogTitle}</h1>
            {seoMetadata?.description && (
              <p className="result__subtitle">{seoMetadata.description}</p>
            )}
          </div>
          <div className="result__actions">
            <button className="btn btn--outline" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button className="btn btn--primary" onClick={reset}>
              <RotateCcw size={14} />
              Start Over
            </button>
          </div>
        </div>

        {/* Blog Content — the hero */}
        <div className="result__content">
          {generatedBlog ? (
            <Markdown>{generatedBlog}</Markdown>
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
      </div>
    </div>
  );
}
