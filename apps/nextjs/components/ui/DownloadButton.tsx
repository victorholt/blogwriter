'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';

export interface DownloadFormat {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface DownloadButtonProps {
  formats: DownloadFormat[];
  label?: string;
  className?: string;
}

export default function DownloadButton({
  formats,
  label = 'Download',
  className = '',
}: DownloadButtonProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Determine if menu should open upward based on available space
  const positionMenu = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const menuHeight = 100; // approximate menu height
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < menuHeight);
  }, []);

  function handleToggle(): void {
    if (!open) positionMenu();
    setOpen(!open);
  }

  function handleSelect(onClick: () => void): void {
    onClick();
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`download-btn ${className}`}>
      <button
        type="button"
        className="btn btn--outline"
        onClick={handleToggle}
      >
        <Download size={14} />
        {label}
      </button>

      {open && (
        <div
          ref={menuRef}
          className={`download-menu ${dropUp ? 'download-menu--up' : ''}`}
        >
          {formats.map((format, i) => (
            <button
              key={i}
              type="button"
              className="download-menu__item"
              onClick={() => handleSelect(format.onClick)}
            >
              {format.icon && (
                <span className="download-menu__icon">{format.icon}</span>
              )}
              {format.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
