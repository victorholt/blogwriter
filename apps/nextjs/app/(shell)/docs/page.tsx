'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { useDocsContext } from './layout';

export default function DocsIndexPage() {
  const { nav, isAdmin } = useDocsContext();
  const router = useRouter();

  useEffect(() => {
    const defaultPage = nav.find((p) => p.isDefault && p.isPublished);
    const first = defaultPage || nav.find((p) => p.isPublished);
    if (first) {
      router.replace(`/docs/${first.slug}`);
    }
  }, [nav, router]);

  // While redirecting or if no published pages
  const hasPublished = nav.some((p) => p.isPublished);
  if (hasPublished) return null; // redirecting

  return (
    <div className="docs-empty">
      <div className="docs-empty__icon">
        <BookOpen size={28} />
      </div>
      {isAdmin ? (
        <>
          <h2 className="docs-empty__title">No docs yet</h2>
          <p className="docs-empty__message">
            Create your first page using the <strong>+ New Page</strong> button in the sidebar.
          </p>
        </>
      ) : (
        <>
          <h2 className="docs-empty__title">Documentation coming soon</h2>
          <p className="docs-empty__message">
            We&rsquo;re working on putting together helpful documentation. Check back soon.
          </p>
        </>
      )}
    </div>
  );
}
