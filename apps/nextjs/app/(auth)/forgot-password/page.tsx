'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://blogwriter.test:4444';

export default function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSent(true);
      }
    } catch {
      setError('Failed to send reset email');
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-card__title">Check your email</h1>
          <p style={{ textAlign: 'center', color: 'var(--color-gray-500)', marginBottom: 16 }}>
            If an account exists with that email, we sent a password reset link.
          </p>
          <div className="auth-card__footer">
            <button className="auth-card__link" onClick={() => router.push('/login')}>
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Forgot password</h1>
        <form className="auth-card__form" onSubmit={handleSubmit}>
          {error && <p className="auth-card__error">{error}</p>}
          <label className="auth-card__label">
            Email address
            <input
              className="auth-card__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </label>
          <button className="auth-card__submit" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
        <div className="auth-card__footer">
          <button className="auth-card__link" onClick={() => router.push('/login')}>
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
