'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Plus, Menu, X, FileText, Mic, UserCog, Settings, LogOut,
  Key, Bot, Package, Palette, Database, Mail, Users, ClipboardList, ArrowLeft, MessageSquare,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useAppSettingsStore } from '@/stores/app-settings-store';
import { useWizardStore } from '@/stores/wizard-store';
import { fetchDefaultSavedVoice } from '@/lib/api';
import SiteFooter from '@/components/SiteFooter';
import FeedbackWidget from '@/components/FeedbackWidget';

const SETTINGS_NAV = [
  { slug: 'general', label: 'General', icon: Settings },
  { slug: 'users', label: 'Users', icon: Users },
  { slug: 'email', label: 'Email', icon: Mail },
  { slug: 'api', label: 'API Config', icon: Key },
  { slug: 'agents', label: 'Agent Models', icon: Bot },
  { slug: 'products', label: 'Product API', icon: Package },
  { slug: 'blog', label: 'Blog', icon: FileText },
  { slug: 'voices', label: 'Voices', icon: Mic },
  { slug: 'themes', label: 'Themes', icon: Palette },
  { slug: 'feedback', label: 'Feedback', icon: MessageSquare },
  { slug: 'audit', label: 'Audit', icon: ClipboardList },
  { slug: 'data', label: 'Data', icon: Database },
] as const;

export default function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user, isAuthenticated, isLoading, guestModeEnabled } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const appName = useAppSettingsStore((s) => s.appName);
  const docsEnabled = useAppSettingsStore((s) => s.docsEnabled);
  const reset = useWizardStore((s) => s.reset);
  const startWithDefaultVoice = useWizardStore((s) => s.startWithDefaultVoice);
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Derive active section for drawer highlights
  const isOnSettings = pathname.startsWith('/settings');
  const currentSection = pathname.replace('/my', '').replace(/^\//, '').split('/')[0] || 'blogs';
  const currentSettingsSection = pathname.replace('/settings', '').replace(/^\//, '') || 'general';

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
                  onClick={() => { logout(); router.push('/login'); }}
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
          {!isLoading && isAuthenticated && user ? (
            <button
              className="app-shell__hamburger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          ) : !isLoading && guestModeEnabled ? (
            <button
              className="app-shell__mobile-login"
              onClick={() => router.push('/login')}
            >
              Log in
            </button>
          ) : null}
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && user && (
        <>
          <div className="app-shell__backdrop" onClick={closeDrawer} />
          <aside className="app-shell__drawer" role="dialog" aria-label="Navigation menu">
            <div className="app-shell__drawer-header">
              <span className="app-shell__drawer-name">{user.displayName}</span>
              <span className="app-shell__drawer-email">{user.email}</span>
              <button
                className="app-shell__drawer-close"
                onClick={closeDrawer}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="app-shell__drawer-body">
              <button
                className="app-shell__drawer-item app-shell__drawer-item--new"
                onClick={() => { closeDrawer(); handleNewBlog(); }}
              >
                <Plus size={16} />
                New Blog
              </button>

              <div className="app-shell__drawer-divider" />

              {isOnSettings && user.role === 'admin' ? (
                <>
                  <Link href="/my/blogs" className="app-shell__drawer-item app-shell__drawer-item--back">
                    <ArrowLeft size={16} />
                    Back
                  </Link>
                  <div className="app-shell__drawer-divider" />
                  <span className="app-shell__drawer-label">Admin Settings</span>
                  {SETTINGS_NAV.map(({ slug, label, icon: Icon }) => (
                    <Link
                      key={slug}
                      href={`/settings/${slug}`}
                      className={`app-shell__drawer-item ${currentSettingsSection === slug ? 'app-shell__drawer-item--active' : ''}`}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  ))}
                </>
              ) : (
                <>
                  <Link
                    href="/my/blogs"
                    className={`app-shell__drawer-item ${currentSection === 'blogs' ? 'app-shell__drawer-item--active' : ''}`}
                  >
                    <FileText size={16} />
                    Blogs
                  </Link>
                  <Link
                    href="/my/voices"
                    className={`app-shell__drawer-item ${currentSection === 'voices' ? 'app-shell__drawer-item--active' : ''}`}
                  >
                    <Mic size={16} />
                    Voices
                  </Link>
                  <Link
                    href="/my/account"
                    className={`app-shell__drawer-item ${currentSection === 'account' ? 'app-shell__drawer-item--active' : ''}`}
                  >
                    <UserCog size={16} />
                    Account
                  </Link>
                  {docsEnabled && (
                    <Link
                      href="/docs"
                      className={`app-shell__drawer-item ${currentSection === 'docs' ? 'app-shell__drawer-item--active' : ''}`}
                    >
                      <FileText size={16} />
                      Docs
                    </Link>
                  )}

                  {user.role === 'admin' && (
                    <>
                      <div className="app-shell__drawer-divider" />
                      <Link
                        href="/settings"
                        className={`app-shell__drawer-item ${isOnSettings ? 'app-shell__drawer-item--active' : ''}`}
                      >
                        <Settings size={16} />
                        Admin Settings
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="app-shell__drawer-footer">
              <button
                className="app-shell__drawer-item app-shell__drawer-item--logout"
                onClick={() => { closeDrawer(); logout(); router.push('/login'); }}
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>
          </aside>
        </>
      )}

      <div className="page-shell">
        <div className="paper">
          {children}
          <SiteFooter />
        </div>
      </div>

      <FeedbackWidget />
    </>
  );
}
