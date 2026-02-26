'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { fetchDocsPage, type DocsPage } from '@/lib/docs-api';
import { fetchAdminDocsPage, type AdminDocsPage } from '@/lib/admin-api';
import DocsContent from '@/components/docs/DocsContent';
import { useDocsContext } from '../layout';

export default function DocsSlugPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const { isAdmin, nav, refreshNav } = useDocsContext();

  const [page, setPage] = useState<DocsPage | AdminDocsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editMode, setEditMode] = useState(searchParams.get('edit') === '1');

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setPage(null);

    async function load() {
      if (isAdmin) {
        const result = await fetchAdminDocsPage(slug);
        if (result.success && result.data) {
          setPage(result.data);
        } else {
          setNotFound(true);
        }
      } else {
        const data = await fetchDocsPage(slug);
        if (data) {
          setPage(data);
        } else {
          setNotFound(true);
        }
      }
      setLoading(false);
    }

    load();
  }, [slug, isAdmin]);

  // Remove ?edit=1 from URL after mounting
  useEffect(() => {
    if (searchParams.get('edit') === '1') {
      setEditMode(true);
      window.history.replaceState({}, '', `/docs/${slug}`);
    }
  }, [slug, searchParams]);

  if (loading) {
    return (
      <div className="docs-loading">
        <Loader2 size={18} className="spin" />
        Loading…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="docs-empty">
        <h2 className="docs-empty__title">Page not found</h2>
        <p className="docs-empty__message">This documentation page doesn&rsquo;t exist or has been removed.</p>
      </div>
    );
  }

  if (!page) return null;

  return (
    <DocsContent
      page={page as AdminDocsPage}
      nav={nav}
      isAdmin={isAdmin}
      editMode={editMode}
      onEditModeChange={setEditMode}
      onSaved={async (updated) => {
        setPage(updated);
        await refreshNav();
      }}
    />
  );
}
