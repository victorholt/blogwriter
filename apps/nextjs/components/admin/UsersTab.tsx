'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://blogwriter.test:4444';

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function UsersTab(): React.ReactElement {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', displayName: '', password: '', role: 'user' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users?page=${p}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data) {
        setUsers(data.data.users);
        setTotalPages(data.data.totalPages);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(page); }, [page, loadUsers]);

  async function handleCreate(): Promise<void> {
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateForm(false);
        setCreateForm({ email: '', displayName: '', password: '', role: 'user' });
        loadUsers(page);
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch {
      setError('Failed to create user');
    }
    setCreating(false);
  }

  async function handleToggleActive(userId: string, isActive: boolean): Promise<void> {
    if (isActive) {
      await fetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'DELETE', credentials: 'include' });
    } else {
      await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: true }),
      });
    }
    loadUsers(page);
  }

  async function handleResetPassword(userId: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    await fetch(`${API_BASE}/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newPassword }),
    });
    setResetPasswordUserId(null);
    setNewPassword('');
  }

  async function handleRoleChange(userId: string, role: string): Promise<void> {
    await fetch(`${API_BASE}/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    });
    loadUsers(page);
  }

  return (
    <section className="settings-section">
      <div className="users-tab__header">
        <h2 className="settings-section__heading">Users</h2>
        <button
          className="btn btn--primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus size={14} />
          Create User
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {showCreateForm && (
        <div className="settings-card users-tab__create-form">
          <h3 className="settings-card__title">New User</h3>
          <div className="settings-card__fields">
            <div className="settings-field">
              <label className="settings-field__label">Email</label>
              <input className="input" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            </div>
            <div className="settings-field">
              <label className="settings-field__label">Display name</label>
              <input className="input" value={createForm.displayName} onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })} />
            </div>
            <div className="settings-card__row">
              <div className="settings-field">
                <label className="settings-field__label">Password</label>
                <input className="input" type="password" placeholder="Min 8 characters" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
              </div>
              <div className="settings-field settings-field--sm">
                <label className="settings-field__label">Role</label>
                <select className="input" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </div>
          <div className="settings-card__footer">
            <button className="btn btn--ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
            <button className="btn btn--primary" onClick={handleCreate} disabled={creating}>
              {creating ? <><Loader2 size={14} className="spin" /> Creating...</> : 'Create User'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="settings-loading">
          <Loader2 size={20} className="spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="settings-card">
          <p className="settings-field__label">No users found.</p>
        </div>
      ) : (
        <div className="users-tab__table-wrap">
          <table className="users-tab__table">
            <thead>
              <tr>
                <th className="users-tab__th">User</th>
                <th className="users-tab__th">Role</th>
                <th className="users-tab__th">Status</th>
                <th className="users-tab__th">Last Login</th>
                <th className="users-tab__th users-tab__th--right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className={!user.isActive ? 'users-tab__row--disabled' : undefined}>
                  <td className="users-tab__td">
                    <span className="users-tab__name">{user.displayName}</span>
                    <span className="users-tab__email">{user.email}</span>
                  </td>
                  <td className="users-tab__td">
                    <select
                      className="users-tab__role-select"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="users-tab__td">
                    <span className={`users-tab__status ${user.isActive ? 'users-tab__status--active' : 'users-tab__status--disabled'}`}>
                      {user.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="users-tab__td users-tab__td--muted">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="users-tab__td users-tab__td--actions">
                    <button
                      className="btn btn--outline btn--sm"
                      onClick={() => { setResetPasswordUserId(user.id); setNewPassword(''); }}
                    >
                      Reset Password
                    </button>
                    <button
                      className={`btn btn--sm ${user.isActive ? 'btn--outline btn--danger' : 'btn--outline btn--accent'}`}
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                    >
                      {user.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetPasswordUserId && (
        <div className="settings-card" style={{ marginTop: 12 }}>
          <h3 className="settings-card__title">Reset Password</h3>
          <div className="settings-field">
            <label className="settings-field__label">New password</label>
            <input
              className="input"
              type="password"
              placeholder="Min 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="settings-card__footer">
            <button className="btn btn--ghost" onClick={() => setResetPasswordUserId(null)}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={() => handleResetPassword(resetPasswordUserId)}>
              Reset Password
            </button>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="blog-dashboard__pagination" style={{ marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </section>
  );
}
