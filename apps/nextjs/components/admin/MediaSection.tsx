'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2, Upload, Copy, Trash2, Check, AlertCircle, File,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  fetchMediaFiles,
  uploadMediaFile,
  updateMediaFile,
  deleteMediaFile,
  fetchSettings,
  updateSettings,
  type MediaFile,
} from '@/lib/admin-api';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';

const PAGE_SIZE = 20;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const DEFAULT_ALLOWED = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

export default function MediaSection(): React.ReactElement {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  // Upload state: map of filename -> status
  const [uploads, setUploads] = useState<Record<string, 'uploading' | 'done' | 'error'>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline copy (action column)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit modal state
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [editAlt, setEditAlt] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  // MIME modal state
  const [showMimeModal, setShowMimeModal] = useState(false);
  const [allowedTags, setAllowedTags] = useState<string[]>(DEFAULT_ALLOWED);
  const [pendingTags, setPendingTags] = useState<string[]>(DEFAULT_ALLOWED);
  const [mimeInput, setMimeInput] = useState('');
  const [mimeSaving, setMimeSaving] = useState(false);
  const mimeInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const res = await fetchMediaFiles();
    if (res.success && res.data) {
      setFiles(res.data);
    } else {
      setError(res.error || 'Failed to load media files');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFiles();
    fetchSettings().then((res) => {
      if (res.success && res.data?.media_allowed_types) {
        const tags = res.data.media_allowed_types.split(',').map((t: string) => t.trim()).filter(Boolean);
        if (tags.length) {
          setAllowedTags(tags);
          setPendingTags(tags);
        }
      }
    });
  }, [loadFiles]);

  // --- Edit modal ---

  function openModal(file: MediaFile, withDeleteConfirm = false): void {
    setSelectedFile(file);
    setEditAlt(file.alt || '');
    setSaving(false);
    setDeleting(false);
    setCopied(false);
    setDeleteConfirm(withDeleteConfirm);
  }

  function handleCloseModal(): void {
    setSelectedFile(null);
    setDeleteConfirm(false);
  }

  async function handleSaveAlt(): Promise<void> {
    if (!selectedFile) return;
    setSaving(true);
    const res = await updateMediaFile(selectedFile.id, { alt: editAlt });
    setSaving(false);
    if (res.success) {
      setFiles((prev) => prev.map((f) => f.id === selectedFile.id ? { ...f, alt: editAlt } : f));
      setSelectedFile((prev) => prev ? { ...prev, alt: editAlt } : null);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!selectedFile) return;
    setDeleting(true);
    await deleteMediaFile(selectedFile.id);
    setDeleting(false);
    const removedId = selectedFile.id;
    setSelectedFile(null);
    setDeleteConfirm(false);
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== removedId && f.parentId !== removedId);
      const maxPage = Math.max(1, Math.ceil(next.length / PAGE_SIZE));
      setPage((p) => Math.min(p, maxPage));
      return next;
    });
  }

  function handleCopyUrl(): void {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // --- Upload ---

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    e.target.value = '';

    for (const file of selected) {
      setUploads((prev) => ({ ...prev, [file.name]: 'uploading' }));
      const res = await uploadMediaFile(file);
      if (res.success) {
        setUploads((prev) => ({ ...prev, [file.name]: 'done' }));
        setTimeout(() => setUploads((prev) => { const n = { ...prev }; delete n[file.name]; return n; }), 2500);
        await loadFiles();
        setPage(1);
      } else {
        setUploads((prev) => ({ ...prev, [file.name]: 'error' }));
        setTimeout(() => setUploads((prev) => { const n = { ...prev }; delete n[file.name]; return n; }), 4000);
      }
    }
  }

  // --- MIME modal ---

  function openMimeModal(): void {
    setPendingTags([...allowedTags]);
    setMimeInput('');
    setShowMimeModal(true);
  }

  function addPendingTag(raw: string): void {
    const val = raw.trim().toLowerCase();
    if (!val || pendingTags.includes(val)) return;
    setPendingTags((prev) => [...prev, val]);
    setMimeInput('');
  }

  function removePendingTag(tag: string): void {
    setPendingTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleMimeKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addPendingTag(mimeInput);
    } else if (e.key === 'Backspace' && !mimeInput && pendingTags.length) {
      setPendingTags((prev) => prev.slice(0, -1));
    }
  }

  async function handleSaveMimeTypes(): Promise<void> {
    setMimeSaving(true);
    const res = await updateSettings({ media_allowed_types: pendingTags.join(',') });
    setMimeSaving(false);
    if (res.success) {
      setAllowedTags([...pendingTags]);
      setShowMimeModal(false);
    }
  }

  // --- Table ---

  const totalPages = Math.max(1, Math.ceil(files.length / PAGE_SIZE));
  const pagedFiles = files.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const uploadEntries = Object.entries(uploads);

  const columns = [
    {
      key: 'thumb',
      header: '',
      width: '64px',
      render: (file: MediaFile) =>
        isImageMime(file.mimeType) ? (
          <img className="media-thumb" src={file.url} alt={file.alt || file.filename} loading="lazy" />
        ) : (
          <div className="media-thumb media-thumb--doc">
            <File size={18} strokeWidth={1.5} />
          </div>
        ),
    },
    {
      key: 'file',
      header: 'File',
      render: (file: MediaFile) => (
        <div className="media-file-cell">
          <span className="media-file-cell__name" title={file.filename}>{file.filename}</span>
          <span className="media-mime-badge">{file.mimeType}</span>
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      width: '80px',
      render: (file: MediaFile) => formatBytes(file.size),
    },
    {
      key: 'uploaded',
      header: 'Uploaded',
      width: '90px',
      render: (file: MediaFile) => shortDate(file.createdAt),
    },
    {
      key: 'actions',
      header: '',
      width: '72px',
      render: (file: MediaFile) => (
        <div className="media-table-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn btn--ghost btn--sm"
            title="Copy URL"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(file.url);
              setCopiedId(file.id);
              setTimeout(() => setCopiedId((id) => id === file.id ? null : id), 2000);
            }}
          >
            {copiedId === file.id ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <button
            className="btn btn--ghost btn--sm media-table-actions__delete"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              openModal(file, true);
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="media-section">

      {/* Allowed Types card */}
      <div className="settings-card">
        <div className="settings-card__title-row">
          <span className="settings-card__title">Allowed File Types</span>
          <button className="btn btn--ghost btn--sm" onClick={openMimeModal}>Edit</button>
        </div>
        <div className="media-mime-pills">
          {allowedTags.map((tag) => (
            <span key={tag} className="media-mime-badge">{tag}</span>
          ))}
        </div>
      </div>

      {/* Media Library card */}
      <div className="settings-card">
        <div className="settings-card__title-row">
          <span className="settings-card__title">Media Library</span>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={allowedTags.join(',')}
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
        </div>

        {/* Upload progress badges */}
        {uploadEntries.length > 0 && (
          <div className="media-upload-progress">
            {uploadEntries.map(([name, status]) => (
              <div key={name} className={`media-upload-badge media-upload-badge--${status}`}>
                {status === 'uploading' && <Loader2 size={12} className="spin" />}
                {status === 'done' && <Check size={12} />}
                {status === 'error' && <AlertCircle size={12} />}
                <span>{name}</span>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="media-loading">
            <Loader2 size={18} className="spin" />
            Loading...
          </div>
        )}

        {!loading && error && (
          <div className="feedback-error">{error}</div>
        )}

        {!loading && !error && (
          <DataTable
            columns={columns}
            rows={pagedFiles}
            getKey={(f) => f.id}
            onRowClick={(f) => openModal(f)}
            emptyMessage="No media files yet. Upload your first file above."
          />
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="blog-dashboard__pagination">
            <button
              className="btn btn--ghost btn--sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="blog-dashboard__pagination-info">Page {page} of {totalPages}</span>
            <button
              className="btn btn--ghost btn--sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Edit File Modal */}
      <Modal open={!!selectedFile} onClose={handleCloseModal} title={selectedFile?.filename}>
        {selectedFile && (
          <div className="media-modal">

            {/* Preview */}
            <div className="media-modal__preview">
              {isImageMime(selectedFile.mimeType) ? (
                <img src={selectedFile.url} alt={selectedFile.alt || selectedFile.filename} />
              ) : (
                <div className="media-modal__file-icon">
                  <File size={40} strokeWidth={1.5} />
                  <span>{selectedFile.filename.split('.').pop()?.toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Meta row */}
            <div className="media-modal__meta">
              <span className="media-mime-badge">{selectedFile.mimeType}</span>
              <span className="media-modal__meta-sep">{formatBytes(selectedFile.size)}</span>
              <span className="media-modal__meta-sep">{shortDate(selectedFile.createdAt)}</span>
              {selectedFile.width && selectedFile.height && (
                <span className="media-modal__meta-sep">{selectedFile.width}x{selectedFile.height}</span>
              )}
            </div>

            {/* Alt text */}
            <div className="media-modal__field">
              <label className="media-modal__label">Alt text</label>
              <textarea
                className="media-modal__textarea"
                rows={3}
                placeholder="Describe this image for accessibility..."
                value={editAlt}
                onChange={(e) => setEditAlt(e.target.value)}
              />
            </div>

            {/* URL */}
            <div className="media-modal__url">
              <span className="media-modal__url-text" title={selectedFile.url}>{selectedFile.url}</span>
              <button className="btn btn--ghost btn--sm" onClick={handleCopyUrl} title="Copy URL">
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>

            {/* Footer */}
            <div className="media-modal__footer">
              <div className="media-modal__footer-left">
                {deleteConfirm ? (
                  <div className="media-modal__delete-confirm">
                    {(selectedFile.childCount ?? 0) > 0 && (
                      <span className="media-modal__delete-warning">
                        Also deletes {selectedFile.childCount} derivative{selectedFile.childCount !== 1 ? 's' : ''}.
                      </span>
                    )}
                    <span className="media-modal__delete-warning">Delete this file?</span>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? <Loader2 size={12} className="spin" /> : 'Yes, delete'}
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setDeleteConfirm(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn--ghost btn--sm media-modal__delete-btn"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                )}
              </div>
              <div className="media-modal__footer-right">
                <button className="btn btn--primary btn--sm" onClick={handleSaveAlt} disabled={saving}>
                  {saving ? <><Loader2 size={12} className="spin" /> Saving...</> : 'Save'}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={handleCloseModal}>Close</button>
              </div>
            </div>

          </div>
        )}
      </Modal>

      {/* MIME Types Modal */}
      <Modal open={showMimeModal} onClose={() => setShowMimeModal(false)} title="Allowed File Types">
        <div className="media-mime-modal">
          <p className="media-mime-modal__hint">Tab, Enter, or comma to add &middot; Backspace to remove last</p>
          <div
            className="mime-tag-input"
            onClick={() => mimeInputRef.current?.focus()}
          >
            {pendingTags.map((tag) => (
              <span key={tag} className="mime-tag">
                {tag}
                <button
                  type="button"
                  className="mime-tag__remove"
                  onClick={(e) => { e.stopPropagation(); removePendingTag(tag); }}
                  aria-label={`Remove ${tag}`}
                >x</button>
              </span>
            ))}
            <input
              ref={mimeInputRef}
              className="mime-tag-input__field"
              value={mimeInput}
              onChange={(e) => setMimeInput(e.target.value)}
              onKeyDown={handleMimeKeyDown}
              onBlur={() => addPendingTag(mimeInput)}
              placeholder={pendingTags.length ? '' : 'image/jpeg'}
            />
          </div>
          <div className="media-mime-modal__footer">
            <button
              className="btn btn--primary btn--sm"
              onClick={handleSaveMimeTypes}
              disabled={mimeSaving}
            >
              {mimeSaving ? <><Loader2 size={12} className="spin" /> Saving...</> : 'Save'}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowMimeModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
