'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search, Plus, ChevronDown, ChevronRight as ChevronRightIcon,
  ArrowUp, ArrowDown, Trash2, BookOpen, X,
} from 'lucide-react';
import { useDocsContext } from '@/app/(shell)/docs/layout';
import type { AdminDocsNavItem } from '@/lib/admin-api';

interface DocsSidebarProps {
  onAddPage: () => void;
  onClose?: () => void;
}

interface NavItemProps {
  item: AdminDocsNavItem;
  children: AdminDocsNavItem[];
  allItems: AdminDocsNavItem[];
  depth: number;
  isAdmin: boolean;
  currentSlug: string;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}

function NavItem({ item, children, allItems, depth, isAdmin, currentSlug, onDelete, onMove }: NavItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isActive = item.slug === currentSlug;
  const hasChildren = children.length > 0;

  return (
    <div className="docs-nav__item-wrap">
      <div
        className={`docs-nav__item${isActive ? ' docs-nav__item--active' : ''}${!item.isPublished ? ' docs-nav__item--draft' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren && (
          <button
            className="docs-nav__expand"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRightIcon size={12} />}
          </button>
        )}
        {!hasChildren && <span className="docs-nav__expand-spacer" />}

        <Link href={`/docs/${item.slug}`} className="docs-nav__link">
          {item.title}
          {isAdmin && !item.isPublished && (
            <span className="docs-nav__draft-badge">Draft</span>
          )}
        </Link>

        {isAdmin && (
          <div className="docs-nav__admin-actions">
            {confirmDelete ? (
              <>
                <button className="docs-nav__action docs-nav__action--danger" onClick={() => onDelete(item.id)} title="Confirm delete">
                  Yes
                </button>
                <button className="docs-nav__action" onClick={() => setConfirmDelete(false)} title="Cancel">
                  No
                </button>
              </>
            ) : (
              <>
                <button className="docs-nav__action" onClick={() => onMove(item.id, 'up')} title="Move up">
                  <ArrowUp size={11} />
                </button>
                <button className="docs-nav__action" onClick={() => onMove(item.id, 'down')} title="Move down">
                  <ArrowDown size={11} />
                </button>
                <button className="docs-nav__action docs-nav__action--danger" onClick={() => setConfirmDelete(true)} title="Delete page">
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="docs-nav__children">
          {children.map((child) => (
            <NavItem
              key={child.id}
              item={child}
              children={allItems.filter((p) => p.parentId === child.id)}
              allItems={allItems}
              depth={depth + 1}
              isAdmin={isAdmin}
              currentSlug={currentSlug}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocsSidebar({ onAddPage, onClose }: DocsSidebarProps) {
  const pathname = usePathname();
  const { nav, isAdmin, onDeletePage, onReorderPages } = useDocsContext();
  const [search, setSearch] = useState('');

  const currentSlug = pathname.replace('/docs/', '').replace('/docs', '');

  const filtered = useMemo(() => {
    if (!search.trim()) return nav;
    const q = search.toLowerCase();
    return nav.filter((p) => p.title.toLowerCase().includes(q));
  }, [nav, search]);

  const rootItems = useMemo(
    () => filtered.filter((p) => !p.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
    [filtered],
  );

  async function handleDelete(id: string) {
    await onDeletePage(id);
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const sameLevelItems = nav
      .filter((p) => {
        const item = nav.find((x) => x.id === id);
        return p.parentId === (item?.parentId ?? null);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const idx = sameLevelItems.findIndex((p) => p.id === id);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= sameLevelItems.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...sameLevelItems];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];

    await onReorderPages(
      updated.map((p, i) => ({ id: p.id, sortOrder: i, parentId: p.parentId })),
    );
  }

  return (
    <div className="docs-sidebar__inner">
      {/* Header */}
      <div className="docs-sidebar__header">
        <div className="docs-sidebar__brand">
          <BookOpen size={16} />
          <span>Documentation</span>
        </div>
        {onClose && (
          <button className="docs-sidebar__close" onClick={onClose} aria-label="Close sidebar">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search + add */}
      <div className="docs-search">
        <Search size={14} className="docs-search__icon" />
        <input
          className="docs-search__input"
          placeholder="Search docs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isAdmin && (
          <button className="docs-search__add-btn" onClick={onAddPage} title="New page">
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Nav tree */}
      <nav className="docs-nav" aria-label="Documentation navigation">
        {rootItems.length === 0 ? (
          <p className="docs-nav__empty">
            {search ? 'No results' : isAdmin ? 'No pages yet' : 'No documentation available'}
          </p>
        ) : (
          rootItems.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              children={filtered.filter((p) => p.parentId === item.id).sort((a, b) => a.sortOrder - b.sortOrder)}
              allItems={filtered}
              depth={0}
              isAdmin={isAdmin}
              currentSlug={currentSlug}
              onDelete={handleDelete}
              onMove={handleMove}
            />
          ))
        )}
      </nav>
    </div>
  );
}
