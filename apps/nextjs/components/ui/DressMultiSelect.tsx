'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { fetchDresses } from '@/lib/api';
import type { Dress } from '@/types';

interface DressMultiSelectProps {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  dressesMap: Map<string, Dress>;
  addDressesToMap: (dresses: Dress[]) => void;
  unfiltered?: boolean;
}

const PAGE_SIZE = 20;

export default function DressMultiSelect({
  selectedIds,
  onToggle,
  onClear,
  dressesMap,
  addDressesToMap,
  unfiltered = false,
}: DressMultiSelectProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusIndex, setFocusIndex] = useState(-1);
  const [dresses, setDresses] = useState<Dress[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Lock body scroll on mobile when open, focus search
  useEffect(() => {
    if (open) {
      setFocusIndex(-1);
      document.body.classList.add('search-select-body-lock');
      requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      document.body.classList.remove('search-select-body-lock');
    }
    return () => document.body.classList.remove('search-select-body-lock');
  }, [open]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-option-index]');
    items[focusIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  // Load dresses from API
  const loadDresses = useCallback(async (searchQuery: string, pageNum: number, append: boolean): Promise<void> => {
    setLoading(true);
    try {
      const result = await fetchDresses({
        page: pageNum,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
        unfiltered: unfiltered || undefined,
      });
      if (result.success && result.data) {
        const fetched = result.data.dresses;
        setDresses((prev) => append ? [...prev, ...fetched] : fetched);
        setTotalPages(result.data.totalPages);
        setPage(pageNum);
        addDressesToMap(fetched);
      }
    } finally {
      setLoading(false);
    }
  }, [addDressesToMap, unfiltered]);

  // Load initial page when dropdown opens
  useEffect(() => {
    if (open) {
      loadDresses(search, 1, false);
    }
    // Only trigger on open, not on search (search is debounced separately)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadDresses(search, 1, false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function handleLoadMore(): void {
    loadDresses(search, page + 1, true);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, dresses.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusIndex >= 0 && dresses[focusIndex]) {
          onToggle(dresses[focusIndex].externalId);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  }

  // Build badge list from selected IDs
  const selectedDresses = Array.from(selectedIds)
    .map((id) => dressesMap.get(id))
    .filter(Boolean) as Dress[];

  return (
    <div
      className={`dress-multi-select ${open ? 'dress-multi-select--open' : ''}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      <button
        type="button"
        className="dress-multi-select__trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedDresses.length === 0 ? (
          <span className="dress-multi-select__placeholder">Select dresses...</span>
        ) : (
          <div className="dress-multi-select__badges">
            {selectedDresses.map((dress) => (
              <span key={dress.externalId} className="dress-multi-select__badge">
                {dress.styleId || dress.name}
                <span
                  className="dress-multi-select__badge-x"
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(dress.externalId);
                  }}
                >
                  <X size={12} />
                </span>
              </span>
            ))}
          </div>
        )}
        <ChevronDown
          size={14}
          className={`dress-multi-select__chevron ${open ? 'dress-multi-select__chevron--open' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="dress-multi-select__backdrop" onClick={() => setOpen(false)} />
          <div className="dress-multi-select__dropdown">
            {/* Header */}
            <div className="dress-multi-select__header">
              <div className="dress-multi-select__search-wrap">
                <Search size={14} className="dress-multi-select__search-icon" />
                <input
                  ref={searchRef}
                  type="text"
                  className="dress-multi-select__search"
                  placeholder="Search dresses..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setFocusIndex(-1);
                  }}
                />
              </div>
              <button
                type="button"
                className="dress-multi-select__close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Options list */}
            <div className="dress-multi-select__list" ref={listRef} role="listbox">
              {!loading && dresses.length === 0 && (
                <div className="dress-multi-select__empty">No dresses found</div>
              )}

              {dresses.map((dress, idx) => {
                const isSelected = selectedIds.has(dress.externalId);
                const isFocused = idx === focusIndex;
                return (
                  <button
                    key={dress.externalId}
                    type="button"
                    className={`dress-multi-select__option ${isFocused ? 'dress-multi-select__option--focused' : ''}`}
                    data-option-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onToggle(dress.externalId)}
                    onMouseEnter={() => setFocusIndex(idx)}
                  >
                    <span className={`dress-multi-select__checkbox ${isSelected ? 'dress-multi-select__checkbox--checked' : ''}`}>
                      {isSelected && <Check size={12} />}
                    </span>
                    <span className="dress-multi-select__option-info">
                      <span className="dress-multi-select__option-name">{dress.name}</span>
                      {dress.styleId && (
                        <span className="dress-multi-select__option-style">{dress.styleId}</span>
                      )}
                    </span>
                  </button>
                );
              })}

              {loading && (
                <div className="dress-multi-select__loading">Loading...</div>
              )}

              {!loading && page < totalPages && (
                <button
                  type="button"
                  className="dress-multi-select__load-more"
                  onClick={handleLoadMore}
                >
                  Load more dresses
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="dress-multi-select__footer">
              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  className="dress-multi-select__clear-btn"
                  onClick={onClear}
                >
                  Clear all
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="dress-multi-select__done-btn"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
