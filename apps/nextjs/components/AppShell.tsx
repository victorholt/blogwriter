'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useAppSettingsStore } from '@/stores/app-settings-store';
import { useWizardStore } from '@/stores/wizard-store';
import { fetchDefaultSavedVoice } from '@/lib/api';
import SiteFooter from '@/components/SiteFooter';

export default function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user, isAuthenticated, isLoading, guestModeEnabled } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const appName = useAppSettingsStore((s) => s.appName);
  const reset = useWizardStore((s) => s.reset);
  const startWithDefaultVoice = useWizardStore((s) => s.startWithDefaultVoice);
  const router = useRouter();
  const pathname = usePathname();

  async function handleNewBlog(): Promise<void> {
    if (isAuthenticated) {
      try {
        const result = await fetchDefaultSavedVoice();
        if (result.success && result.data) {
          startWithDefaultVoice(result.data.id, result.data.voiceData, result.data.sourceUrl);
          if (pathname !== '/new') router.push('/new');
          return;
        }
      } catch {
        // Fall through to normal reset
      }
    }
    reset();
    if (pathname === '/new') return;
    router.push('/new');
  }

  return (
    <>
      <header className="app-shell">
        <div className="app-shell__inner">
          <Link href={isAuthenticated ? '/my/blogs' : '/'} className="app-shell__brand">{appName}</Link>
          <nav className="app-shell__nav">
            {!isLoading && isAuthenticated && user ? (
              <>
                <button
                  className="app-shell__btn app-shell__btn--new"
                  onClick={handleNewBlog}
                >
                  <Plus size={14} />
                  New Blog
                </button>
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
      <div className="page-shell">
        <div className="paper">
          {children}
          <SiteFooter />
        </div>
      </div>
    </>
  );
}
