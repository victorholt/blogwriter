'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Edit2, Eye, EyeOff, Star } from 'lucide-react';
import type { AdminDocsNavItem, AdminDocsPage } from '@/lib/admin-api';
import DocsEditor from './DocsEditor';

interface DocsContentProps {
  page: AdminDocsPage;
  nav: AdminDocsNavItem[];
  isAdmin: boolean;
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
  onSaved: (updated: AdminDocsPage) => Promise<void>;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split('\n');
  const items: TocItem[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{2,4})\s+(.+)/);
    if (m) {
      const text = m[2].replace(/\*\*|__|\*|_|`/g, '').trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      items.push({ id, text, level: m[1].length });
    }
  }
  return items;
}

function buildBreadcrumb(page: AdminDocsPage, nav: AdminDocsNavItem[]): AdminDocsNavItem[] {
  const crumbs: AdminDocsNavItem[] = [];
  let current: AdminDocsNavItem | undefined = page as AdminDocsNavItem;
  while (current?.parentId) {
    const parent = nav.find((p) => p.id === current!.parentId);
    if (!parent) break;
    crumbs.unshift(parent);
    current = parent;
  }
  return crumbs;
}

export default function DocsContent({ page, nav, isAdmin, editMode, onEditModeChange, onSaved }: DocsContentProps) {
  const toc = useMemo(() => extractToc(page.content || ''), [page.content]);
  const breadcrumbs = useMemo(() => buildBreadcrumb(page, nav), [page, nav]);

  if (editMode && isAdmin) {
    return (
      <DocsEditor
        page={page}
        nav={nav}
        onSaved={async (updated) => { await onSaved(updated); onEditModeChange(false); }}
        onCancel={() => onEditModeChange(false)}
      />
    );
  }

  return (
    <div className="docs-content">
      {/* Breadcrumb */}
      {breadcrumbs.length > 0 && (
        <nav className="docs-breadcrumb" aria-label="Breadcrumb">
          <Link href="/docs" className="docs-breadcrumb__item">Docs</Link>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="docs-breadcrumb__sep">/
              <Link href={`/docs/${crumb.slug}`} className="docs-breadcrumb__item">{crumb.title}</Link>
            </span>
          ))}
          <span className="docs-breadcrumb__sep">/ <span className="docs-breadcrumb__current">{page.title}</span></span>
        </nav>
      )}

      {/* Admin toolbar */}
      {isAdmin && (
        <div className="docs-admin-bar">
          <button
            className={`docs-admin-bar__default-toggle${page.isDefault ? ' docs-admin-bar__default-toggle--active' : ''}`}
            onClick={async () => {
              if (page.isDefault) return; // already default, no-op
              const { updateDocsPage } = await import('@/lib/admin-api');
              const result = await updateDocsPage(page.id, { isDefault: true });
              if (result.success && result.data) await onSaved(result.data);
            }}
            title={page.isDefault ? 'This is the default page' : 'Set as default landing page'}
          >
            <Star size={13} />
            {page.isDefault ? 'Default' : 'Set default'}
          </button>
          <button
            className={`docs-admin-bar__publish-toggle${page.isPublished ? ' docs-admin-bar__publish-toggle--published' : ''}`}
            onClick={async () => {
              const { updateDocsPage } = await import('@/lib/admin-api');
              const result = await updateDocsPage(page.id, { isPublished: !page.isPublished });
              if (result.success && result.data) await onSaved(result.data);
            }}
            title={page.isPublished ? 'Published — click to unpublish' : 'Draft — click to publish'}
          >
            {page.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
            {page.isPublished ? 'Published' : 'Draft'}
          </button>
          <span className="docs-admin-bar__sep" aria-hidden="true" />
          <button
            className="docs-admin-bar__edit-btn"
            onClick={() => onEditModeChange(true)}
          >
            <Edit2 size={13} />
            Edit
          </button>
        </div>
      )}

      {/* Page title */}
      <h1 className="docs-prose__h1">{page.title}</h1>

      {/* Body + ToC */}
      <div className="docs-content__body">
        <div className="docs-prose">
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            components={{
              a: ({ href, children }) => {
                if (href?.startsWith('/docs/')) {
                  return <Link href={href}>{children}</Link>;
                }
                return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
              },
              h2: ({ children }) => {
                const text = String(children);
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                return <h2 id={id}>{children}</h2>;
              },
              h3: ({ children }) => {
                const text = String(children);
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                return <h3 id={id}>{children}</h3>;
              },
              h4: ({ children }) => {
                const text = String(children);
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                return <h4 id={id}>{children}</h4>;
              },
            }}
          >
            {page.content || ''}
          </ReactMarkdown>
        </div>

        {toc.length > 2 && (
          <aside className="docs-toc">
            <div className="docs-toc__title">On this page</div>
            <nav>
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`docs-toc__item docs-toc__item--h${item.level}`}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>

      {/* Footer */}
      {page.updatedAt && (
        <div className="docs-content__footer">
          Last updated {new Date(page.updatedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      )}
    </div>
  );
}
