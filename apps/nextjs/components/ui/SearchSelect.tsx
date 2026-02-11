'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface SearchSelectOption {
  label: string;
  value: string;
}

export interface SearchSelectGroup {
  label: string;
  options: SearchSelectOption[];
}

interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  groups: SearchSelectGroup[];
  placeholder?: string;
}

export default function SearchSelect({
  value,
  onChange,
  groups,
  placeholder = 'Select...',
}: SearchSelectProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // All options flattened for keyboard navigation
  const allOptions = groups.flatMap((g) => g.options);

  // Filter by search
  const filtered = groups
    .map((g) => ({
      ...g,
      options: g.options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.value.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((g) => g.options.length > 0);

  const flatFiltered = filtered.flatMap((g) => g.options);

  // Find display label for current value
  const selectedOption = allOptions.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  // Close on outside click (desktop only — mobile uses backdrop)
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Lock body scroll when open on mobile, focus search input
  useEffect(() => {
    if (open) {
      setSearch('');
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

  const select = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
    },
    [onChange],
  );

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
        setFocusIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusIndex >= 0 && flatFiltered[focusIndex]) {
          select(flatFiltered[focusIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  }

  return (
    <div
      className={`search-select ${open ? 'search-select--open' : ''}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="search-select__trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`search-select__value ${!selectedOption ? 'search-select__value--placeholder' : ''}`}>
          {displayLabel}
        </span>
        <ChevronDown size={14} className={`search-select__chevron ${open ? 'search-select__chevron--open' : ''}`} />
      </button>

      {open && (
        <>
          <div className="search-select__backdrop" onClick={() => setOpen(false)} />
          <div className="search-select__dropdown">
            <div className="search-select__header">
              <div className="search-select__search-wrap">
                <Search size={14} className="search-select__search-icon" />
                <input
                  ref={searchRef}
                  type="text"
                  className="search-select__search"
                  placeholder="Search models..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setFocusIndex(-1);
                  }}
                />
              </div>
              <button
                type="button"
                className="search-select__close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="search-select__list" ref={listRef} role="listbox">
              {filtered.length === 0 && (
                <div className="search-select__empty">No models found</div>
              )}

              {(() => {
                let optionIdx = 0;
                return filtered.map((group) => (
                  <div key={group.label} className="search-select__group">
                    <div className="search-select__group-label">{group.label}</div>
                    {group.options.map((option) => {
                      const idx = optionIdx++;
                      const isSelected = option.value === value;
                      const isFocused = idx === focusIndex;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`search-select__option ${isSelected ? 'search-select__option--selected' : ''} ${isFocused ? 'search-select__option--focused' : ''}`}
                          data-option-index={idx}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => select(option.value)}
                          onMouseEnter={() => setFocusIndex(idx)}
                        >
                          <span className="search-select__option-text">{option.label}</span>
                          {isSelected && <Check size={14} className="search-select__option-check" />}
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
