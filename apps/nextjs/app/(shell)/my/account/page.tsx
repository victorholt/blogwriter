'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { changePassword } from '@/lib/auth-api';

export default function AccountPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleChangePassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setSaving(true);
    const result = await changePassword(currentPassword, newPassword);
    setSaving(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to change password' });
    }
  }

  return (
    <>
      <h2 className="settings-title" style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Account</h2>
      <p className="settings-subtitle">Manage your account settings</p>

      <div className="settings-card">
        <div className="settings-card__title">Profile</div>
        <div className="settings-card__fields">
          <div className="settings-field">
            <label className="settings-field__label">Display Name</label>
            <input className="input" value={user?.displayName || ''} disabled />
          </div>
          <div className="settings-field">
            <label className="settings-field__label">Email</label>
            <input className="input" value={user?.email || ''} disabled />
          </div>
        </div>
      </div>

      <div className="settings-card" style={{ marginTop: '16px' }}>
        <div className="settings-card__title">Change Password</div>
        <form onSubmit={handleChangePassword}>
          <div className="settings-card__fields">
            <div className="settings-field">
              <label className="settings-field__label">Current Password</label>
              <input
                className="input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="settings-field">
              <label className="settings-field__label">New Password</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field__label">Confirm New Password</label>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>
          {message && (
            <p style={{
              marginTop: '12px',
              fontSize: '13px',
              color: message.type === 'success' ? '#059669' : '#dc2626',
            }}>
              {message.text}
            </p>
          )}
          <div className="settings-card__footer">
            <span />
            <button className="btn btn--primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
