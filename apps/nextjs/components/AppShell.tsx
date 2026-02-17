'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useAppSettingsStore } from '@/stores/app-settings-store';

export default function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user, isAuthenticated, isLoading, guestModeEnabled } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const appName = useAppSettingsStore((s) => s.appName);
  const router = useRouter();

  return (
    <>
      <header className="app-shell">
        <div className="app-shell__inner">
          <Link href="/" className="app-shell__brand">{appName}</Link>
          <nav className="app-shell__nav">
            {!isLoading && isAuthenticated && user ? (
              <>
                <Link href="/my/blogs" className="app-shell__link">My Blogs</Link>
                {user.role === 'admin' && (
                  <Link href="/settings" className="app-shell__link">Settings</Link>
                )}
                <span className="app-shell__name">{user.displayName}</span>
                <button
                  className="app-shell__btn app-shell__btn--logout"
                  onClick={() => logout()}
                >
                  Log out
                </button>
              </>
            ) : !isLoading && guestModeEnabled ? (
              <button
                className="app-shell__btn app-shell__btn--login"
                onClick={() => router.push('/login')}
              >
                Log in
              </button>
            ) : null}
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
