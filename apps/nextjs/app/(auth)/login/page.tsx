'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';

export default function LoginPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const guestModeEnabled = useAuthStore((s) => s.guestModeEnabled);
  const registrationEnabled = useAuthStore((s) => s.registrationEnabled);
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
    setLoading(true);

    const result = await login(email, password);
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
        <h1 className="auth-card__title">Log in</h1>
        <form className="auth-card__form" onSubmit={handleSubmit}>
          {error && <p className="auth-card__error">{error}</p>}
          <label className="auth-card__label">
            Email
            <input
              className="auth-card__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
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
              autoComplete="current-password"
            />
          </label>
          <button className="auth-card__submit" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <div className="auth-card__footer">
          <button className="auth-card__link" onClick={() => router.push('/forgot-password')}>
            Forgot password?
          </button>
        </div>
        {registrationEnabled && (
          <div className="auth-card__footer">
            <span>Don&apos;t have an account?</span>{' '}
            <button className="auth-card__link" onClick={() => router.push('/register')}>
              Register
            </button>
          </div>
        )}
        {guestModeEnabled && (
          <div className="auth-card__footer">
            <button className="auth-card__link" onClick={() => router.push('/')}>
              Continue as guest
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
