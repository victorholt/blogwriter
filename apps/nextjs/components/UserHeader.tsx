'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';

export default function UserHeader(): React.ReactElement | null {
  const { user, isAuthenticated, isLoading, guestModeEnabled } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  // Don't render during initial auth check
  if (isLoading) return null;

  return (
    <header className="user-header">
      <div className="user-header__inner">
        <span className="user-header__brand">BlogWriter</span>
        <nav className="user-header__nav">
          {isAuthenticated && user ? (
            <>
              <button
                className="user-header__link"
                onClick={() => router.push('/blogs')}
              >
                My Blogs
              </button>
              <span className="user-header__name">{user.displayName}</span>
              <button
                className="user-header__btn user-header__btn--logout"
                onClick={() => logout()}
              >
                Log out
              </button>
            </>
          ) : guestModeEnabled ? (
            <button
              className="user-header__btn user-header__btn--login"
              onClick={() => router.push('/login')}
            >
              Log in
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
