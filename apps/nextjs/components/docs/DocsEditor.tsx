'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { useRouter } from 'next/navigation';
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Minus, Link2, Loader2, Trash2,
} from 'lucide-react';
import { updateDocsPage, deleteDocsPage, uploadMediaFile, type AdminDocsPage, type AdminDocsNavItem } from '@/lib/admin-api';

interface DocsEditorProps {
  page: AdminDocsPage;
  nav: AdminDocsNavItem[];
  onSaved: (updated: AdminDocsPage) => Promise<void>;
  onCancel: () => void;
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function ToolbarButton({
  onClick, active, title, children,
}: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`docs-toolbar__btn${active ? ' docs-toolbar__btn--active' : ''}`}
      onClick={onClick}
      title={title}
      onMouseDown={(e) => e.preventDefault()} // prevent blur on editor
    >
      {children}
    </button>
  );
}

export default function DocsEditor({ page, nav, onSaved, onCancel }: DocsEditorProps) {
  const router = useRouter();
  const rootPages = nav.filter((p) => !p.parentId && p.id !== page.id);

  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [parentId, setParentId] = useState<string | null>(page.parentId ?? null);
  const [isPublished, setIsPublished] = useState(page.isPublished);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Image.configure({ allowBase64: true, inline: false }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Markdown.configure({ html: true, tightLists: true }),
    ],
    content: '', // set after mount via setContent
    editorProps: {
      attributes: { class: 'docs-prose docs-prose--editable' },
    },
  });

  // Load initial markdown content
  useEffect(() => {
    if (editor && page.content) {
      editor.commands.setContent(page.content);
    }
  }, [editor, page.id]); // only on page ID change, not every content update

  async function uploadAndInsert(file: File): Promise<void> {
    if (!editor) return;
    const result = await uploadMediaFile(file);
    if (result.success && result.data) {
      editor.chain().focus().setImage({ src: result.data.url, alt: result.data.alt || file.name }).run();
    }
  }

  // Image paste from clipboard
  const handlePaste = useCallback((event: ClipboardEvent) => {
    if (!editor) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        uploadAndInsert(file);
        return;
      }
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Image drag-and-drop
  const handleDrop = useCallback((event: DragEvent) => {
    if (!editor) return;
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        event.preventDefault();
        uploadAndInsert(file);
        return;
      }
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = editor?.view?.dom;
    if (!el) return;
    el.addEventListener('paste', handlePaste as EventListener);
    el.addEventListener('drop', handleDrop as EventListener);
    return () => {
      el.removeEventListener('paste', handlePaste as EventListener);
      el.removeEventListener('drop', handleDrop as EventListener);
    };
  }, [editor, handlePaste, handleDrop]);

  async function handleSave() {
    if (!editor) return;
    setSaveError('');
    setSaving(true);
    const content = editor.storage.markdown.getMarkdown();
    const result = await updateDocsPage(page.id, {
      title: title.trim() || page.title,
      slug: slug || page.slug,
      content,
      parentId,
      isPublished,
    });
    setSaving(false);
    if (!result.success) { setSaveError(result.error || 'Failed to save'); return; }
    // If slug changed, navigate to new slug
    if (result.data!.slug !== page.slug) {
      router.replace(`/docs/${result.data!.slug}`);
    }
    await onSaved(result.data!);
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteDocsPage(page.id);
    router.replace('/docs');
  }

  function handleInsertLink() {
    const url = window.prompt('Enter URL:');
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  }

  if (!editor) return null;

  return (
    <div className="docs-editor">
      {/* Meta bar */}
      <div className="docs-editor-meta">
        <input
          ref={titleRef}
          className="docs-editor-meta__title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (slug === slugify(page.title)) setSlug(slugify(e.target.value));
          }}
          placeholder="Page title"
        />
        <div className="docs-editor-meta__row">
          <div className="docs-editor-meta__slug-wrap">
            <span className="docs-editor-meta__slug-prefix">/docs/</span>
            <input
              className="docs-editor-meta__slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="page-slug"
            />
          </div>
          {rootPages.length > 0 && (
            <select
              className="docs-editor-meta__parent"
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
            >
              <option value="">No parent</option>
              {rootPages.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          )}
          <label className="docs-editor-meta__publish-toggle">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            Published
          </label>
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="docs-toolbar">
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 size={15} />
        </ToolbarButton>

        <span className="docs-toolbar__sep" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          <Code size={15} />
        </ToolbarButton>

        <span className="docs-toolbar__sep" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <Quote size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{'{ }'}</span>
        </ToolbarButton>

        <span className="docs-toolbar__sep" />

        <ToolbarButton onClick={handleInsertLink} active={editor.isActive('link')} title="Insert link">
          <Link2 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus size={15} />
        </ToolbarButton>
      </div>

      {/* Editable paper */}
      <EditorContent editor={editor} className="docs-editor__paper" />

      {/* Action bar */}
      <div className="docs-editor-actions">
        <div className="docs-editor-actions__left">
          {!confirmDelete ? (
            <button
              className="docs-editor-actions__delete"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
            >
              <Trash2 size={13} />
              Delete page
            </button>
          ) : (
            <div className="docs-editor-actions__confirm-delete">
              <span>Delete this page?</span>
              <button className="docs-editor-actions__delete" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 size={13} className="spin" /> : null}
                Yes, delete
              </button>
              <button className="btn btn--ghost" style={{ fontSize: 13 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}
        </div>
        <div className="docs-editor-actions__right">
          {saveError && <span className="docs-editor-actions__error">{saveError}</span>}
          <button className="btn btn--ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={13} className="spin" /> Saving…</> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
