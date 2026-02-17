'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Eye, Trash2, Pencil, Check, X } from 'lucide-react';
import { fetchMyBlogs, updateBlogTitle, deleteBlog, type BlogListItem } from '@/lib/blog-api';

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const cls = status === 'completed' ? 'blog-table__status--completed'
    : status === 'error' ? 'blog-table__status--error'
    : 'blog-table__status--generating';

  return <span className={`blog-table__status ${cls}`}>{status}</span>;
}

function BlogRow({ blog, onDelete, onRename }: {
  blog: BlogListItem;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(blog.title || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();

  function handleSaveTitle(): void {
    if (title.trim() && title.trim() !== blog.title) {
      onRename(blog.id, title.trim());
    }
    setEditing(false);
  }

  function handleCancelEdit(): void {
    setTitle(blog.title || '');
    setEditing(false);
  }

  return (
    <tr
      className="blog-table__row"
      onClick={() => blog.status === 'completed' ? router.push(`/my/blogs/${blog.id}`) : undefined}
      style={{ cursor: blog.status === 'completed' ? 'pointer' : 'default' }}
    >
      <td className="blog-table__td blog-table__td--title">
        {editing ? (
          <div className="blog-table__edit-row" onClick={(e) => e.stopPropagation()}>
            <input
              className="blog-table__edit-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              autoFocus
            />
            <button className="blog-table__icon-btn blog-table__icon-btn--confirm" onClick={handleSaveTitle}>
              <Check size={14} />
            </button>
            <button className="blog-table__icon-btn blog-table__icon-btn--cancel" onClick={handleCancelEdit}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <div>
            <span className="blog-table__title">{blog.title || 'Untitled Blog'}</span>
            {blog.brandLabelSlug && (
              <span className="blog-table__subtitle">{blog.brandLabelSlug}</span>
            )}
          </div>
        )}
      </td>
      <td className="blog-table__td blog-table__td--status">
        <StatusBadge status={blog.status} />
      </td>
      <td className="blog-table__td blog-table__td--date">
        {new Date(blog.createdAt).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })}
      </td>
      <td className="blog-table__td blog-table__td--actions" onClick={(e) => e.stopPropagation()}>
        {confirmDelete ? (
          <div className="blog-table__confirm-delete">
            <span className="blog-table__confirm-text">Delete?</span>
            <button
              className="blog-table__icon-btn blog-table__icon-btn--confirm-del"
              onClick={() => onDelete(blog.id)}
            >
              Yes
            </button>
            <button
              className="blog-table__icon-btn blog-table__icon-btn--cancel"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </button>
          </div>
        ) : (
          <>
            <button
              className="blog-table__icon-btn"
              onClick={() => setEditing(true)}
              title="Rename"
            >
              <Pencil size={14} />
            </button>
            {blog.status === 'completed' && (
              <button
                className="blog-table__icon-btn blog-table__icon-btn--view"
                onClick={() => router.push(`/my/blogs/${blog.id}`)}
                title="View"
              >
                <Eye size={14} />
              </button>
            )}
            <button
              className="blog-table__icon-btn blog-table__icon-btn--delete"
              onClick={() => setConfirmDelete(true)}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

export default function BlogsPage(): React.ReactElement {
  const router = useRouter();
  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadBlogs = useCallback(async (p: number) => {
    setLoading(true);
    const result = await fetchMyBlogs(p);
    if (result.success && result.data) {
      setBlogs(result.data.blogs);
      setTotalPages(result.data.totalPages);
      setTotal(result.data.total ?? result.data.blogs.length);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBlogs(page);
  }, [page, loadBlogs]);

  async function handleDelete(id: string): Promise<void> {
    const result = await deleteBlog(id);
    if (result.success) {
      setBlogs((prev) => prev.filter((b) => b.id !== id));
      setTotal((t) => t - 1);
    }
  }

  async function handleRename(id: string, title: string): Promise<void> {
    await updateBlogTitle(id, title);
    setBlogs((prev) => prev.map((b) => (b.id === id ? { ...b, title } : b)));
  }

  return (
    <div className="blog-dashboard">
      <div className="blog-dashboard__header">
        <div>
          <h1 className="blog-dashboard__title">My Blogs</h1>
          {!loading && blogs.length > 0 && (
            <p className="blog-dashboard__count">{total} blog{total !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="blog-dashboard__loading">
          <div className="blog-dashboard__spinner" />
          <p>Loading your blogs...</p>
        </div>
      ) : blogs.length === 0 ? (
        <div className="blog-dashboard__empty">
          <div className="blog-dashboard__empty-icon">
            <FileText size={40} strokeWidth={1.2} />
          </div>
          <h2 className="blog-dashboard__empty-title">No blogs yet</h2>
          <p className="blog-dashboard__empty-text">
            Create your first AI-powered blog post and it will show up here.
          </p>
          <button
            className="btn btn--primary btn--lg"
            onClick={() => router.push('/')}
          >
            <Plus size={16} />
            Create Your First Blog
          </button>
        </div>
      ) : (
        <>
          <div className="blog-table__wrap">
            <table className="blog-table">
              <thead>
                <tr>
                  <th className="blog-table__th">Title</th>
                  <th className="blog-table__th">Status</th>
                  <th className="blog-table__th">Created</th>
                  <th className="blog-table__th blog-table__th--actions" />
                </tr>
              </thead>
              <tbody>
                {blogs.map((blog) => (
                  <BlogRow
                    key={blog.id}
                    blog={blog}
                    onDelete={handleDelete}
                    onRename={handleRename}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="blog-dashboard__pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
