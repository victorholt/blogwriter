'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://blogwriter.test:4444';

function ResetPasswordForm(): React.ReactElement {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && !authLoading) router.replace('/');
  }, [isAuthenticated, authLoading, router]);

  if (isAuthenticated && !authLoading) {
    return <div className="auth-page" />;
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch {
      setError('Failed to reset password');
    }
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-card__title">Invalid link</h1>
          <p style={{ textAlign: 'center', color: 'var(--color-gray-500)' }}>
            This reset link is invalid or has expired.
          </p>
          <div className="auth-card__footer">
            <button className="auth-card__link" onClick={() => router.push('/forgot-password')}>
              Request a new link
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-card__title">Password reset</h1>
          <p style={{ textAlign: 'center', color: 'var(--color-gray-500)', marginBottom: 16 }}>
            Your password has been reset successfully.
          </p>
          <div className="auth-card__footer">
            <button className="auth-card__link" onClick={() => router.push('/login')}>
              Log in with your new password
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Set new password</h1>
        <form className="auth-card__form" onSubmit={handleSubmit}>
          {error && <p className="auth-card__error">{error}</p>}
          <label className="auth-card__label">
            New password
            <input
              className="auth-card__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
              placeholder="Minimum 8 characters"
            />
          </label>
          <label className="auth-card__label">
            Confirm password
            <input
              className="auth-card__input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button className="auth-card__submit" type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-card"><p>Loading...</p></div></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
