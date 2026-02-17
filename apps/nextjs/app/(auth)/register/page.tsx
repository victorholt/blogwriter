'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';

export default function RegisterPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const registrationEnabled = useAuthStore((s) => s.registrationEnabled);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && !authLoading) router.replace('/');
  }, [isAuthenticated, authLoading, router]);

  if (isAuthenticated && !authLoading) {
    return <div className="auth-page" />;
  }

  if (!authLoading && !registrationEnabled) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-card__title">Registration Closed</h1>
          <p className="auth-card__description">
            New account registration is currently disabled. Please contact an administrator if you need access.
          </p>
          <div className="auth-card__footer">
            <span>Already have an account?</span>{' '}
            <button className="auth-card__link" onClick={() => router.push('/login')}>
              Log in
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await register(email, password, displayName);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push('/');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Create account</h1>
        <form className="auth-card__form" onSubmit={handleSubmit}>
          {error && <p className="auth-card__error">{error}</p>}
          <label className="auth-card__label">
            Display name
            <input
              className="auth-card__input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="auth-card__label">
            Email
            <input
              className="auth-card__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="auth-card__label">
            Password
            <input
              className="auth-card__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
            />
          </label>
          <button className="auth-card__submit" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <div className="auth-card__footer">
          <span>Already have an account?</span>{' '}
          <button className="auth-card__link" onClick={() => router.push('/login')}>
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}
