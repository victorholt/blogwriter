'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useAppSettingsStore } from '@/stores/app-settings-store';
import DocsSidebar from '@/components/docs/DocsSidebar';
import { fetchDocsNav, type DocsNavItem } from '@/lib/docs-api';
import { fetchAdminDocsNav, createDocsPage, deleteDocsPage, reorderDocsPages, type AdminDocsNavItem } from '@/lib/admin-api';
import Modal from '@/components/ui/Modal';
import { BookOpen, Loader2 } from 'lucide-react';

interface DocsContextValue {
  nav: AdminDocsNavItem[];
  isAdmin: boolean;
  refreshNav: () => void;
  onDeletePage: (id: string) => Promise<void>;
  onReorderPages: (items: Array<{ id: string; sortOrder: number; parentId?: string | null }>) => Promise<void>;
}

export const DocsContext = createContext<DocsContextValue>({
  nav: [],
  isAdmin: false,
  refreshNav: () => {},
  onDeletePage: async () => {},
  onReorderPages: async () => {},
});

export function useDocsContext() {
  return useContext(DocsContext);
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const docsEnabled = useAppSettingsStore((s) => s.docsEnabled);
  const settingsReady = useAppSettingsStore((s) => s.settingsReady);
  const router = useRouter();

  const [nav, setNav] = useState<AdminDocsNavItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // New page modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const refreshNav = useCallback(async () => {
    if (isAdmin) {
      const result = await fetchAdminDocsNav();
      if (result.success && result.data) setNav(result.data);
    } else {
      const items = await fetchDocsNav();
      setNav(items.map((i: DocsNavItem) => ({ ...i, isPublished: true })));
    }
  }, [isAdmin]);

  useEffect(() => { refreshNav(); }, [refreshNav]);

  async function handleDeletePage(id: string): Promise<void> {
    await deleteDocsPage(id);
    await refreshNav();
  }

  async function handleReorderPages(items: Array<{ id: string; sortOrder: number; parentId?: string | null }>): Promise<void> {
    await reorderDocsPages(items);
    await refreshNav();
  }

  function handleTitleChange(title: string): void {
    setNewTitle(title);
    setNewSlug(slugify(title));
  }

  async function handleCreatePage(): Promise<void> {
    setCreateError('');
    if (!newTitle.trim()) { setCreateError('Title is required'); return; }
    const slug = newSlug || slugify(newTitle);
    if (!slug) { setCreateError('Could not generate a valid slug'); return; }
    setCreating(true);
    const result = await createDocsPage({ title: newTitle.trim(), slug, parentId: newParentId || null, sortOrder: nav.length, isPublished: false });
    setCreating(false);
    if (!result.success) { setCreateError(result.error || 'Failed to create page'); return; }
    setShowNewModal(false);
    setNewTitle('');
    setNewSlug('');
    setNewParentId(null);
    await refreshNav();
    router.push(`/docs/${result.data!.slug}?edit=1`);
  }

  useEffect(() => {
    if (settingsReady && !docsEnabled && !isAdmin) {
      router.replace('/');
    }
  }, [settingsReady, docsEnabled, isAdmin, router]);

  const rootPages = nav.filter((p) => !p.parentId);

  // Show nothing (redirect pending) only when settings are ready and docs are disabled
  if (settingsReady && !docsEnabled && !isAdmin) return null;
  // While settings are still loading, show a minimal loading state so the page isn't blank
  if (!settingsReady) {
    return (
      <div className="docs-loading">
        <Loader2 size={18} className="spin" />
        Loading...
      </div>
    );
  }

  return (
    <DocsContext.Provider value={{ nav, isAdmin, refreshNav, onDeletePage: handleDeletePage, onReorderPages: handleReorderPages }}>
      <div className="docs-layout">
        {/* Mobile sidebar toggle */}
        <button
          className="docs-layout__mobile-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle docs navigation"
        >
          <BookOpen size={18} />
          <span>Docs</span>
        </button>

        {/* Sidebar */}
        <aside className={`docs-sidebar${sidebarOpen ? ' docs-sidebar--open' : ''}`}>
          <DocsSidebar
            onAddPage={() => { setShowNewModal(true); setSidebarOpen(false); }}
            onClose={() => setSidebarOpen(false)}
          />
        </aside>

        {/* Backdrop on mobile */}
        {sidebarOpen && (
          <div className="docs-layout__backdrop" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content */}
        <main className="docs-main">
          {children}
        </main>
      </div>

      {/* New Page Modal */}
      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="New Page">
        <div className="docs-new-page-form">
          <div className="docs-new-page-form__field">
            <label>Title</label>
            <input
              className="input"
              placeholder="e.g. Getting Started"
              value={newTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePage(); }}
            />
          </div>
          <div className="docs-new-page-form__field">
            <label>Slug</label>
            <div className="docs-new-page-form__slug-wrap">
              <span className="docs-new-page-form__slug-prefix">/docs/</span>
              <input
                className="input"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="getting-started"
              />
            </div>
          </div>
          {nav.length > 0 && (
            <div className="docs-new-page-form__field">
              <label>Parent (optional)</label>
              <select
                className="input"
                value={newParentId || ''}
                onChange={(e) => setNewParentId(e.target.value || null)}
              >
                <option value="">None (root level)</option>
                {rootPages.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}
          {createError && <div className="feedback-error">{createError}</div>}
          <div className="docs-new-page-form__actions">
            <button className="btn btn--primary" onClick={handleCreatePage} disabled={creating}>
              {creating ? 'Creating…' : 'Create Page'}
            </button>
            <button className="btn btn--ghost" onClick={() => setShowNewModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </DocsContext.Provider>
  );
}
