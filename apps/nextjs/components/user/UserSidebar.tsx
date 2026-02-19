'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { FileText, Mic, UserCog, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { slug: 'blogs', label: 'Blogs', icon: FileText },
  { slug: 'voices', label: 'Voices', icon: Mic },
  { slug: 'account', label: 'Account', icon: UserCog },
] as const;

export default function UserSidebar(): React.ReactElement {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const currentSection = pathname.replace('/my', '').replace(/^\//, '').split('/')[0] || 'blogs';

  return (
    <nav className="user-sidebar">
      {NAV_ITEMS.map(({ slug, label, icon: Icon }) => {
        const isActive = currentSection === slug;
        return (
          <Link
            key={slug}
            href={`/my/${slug}`}
            className={`user-sidebar__item ${isActive ? 'user-sidebar__item--active' : ''}`}
          >
            <Icon size={15} />
            {label}
          </Link>
        );
      })}
      {user?.role === 'admin' && (
        <>
          <div className="user-sidebar__divider" />
          <Link
            href="/settings"
            className="user-sidebar__item"
          >
            <Settings size={15} />
            Admin Settings
          </Link>
        </>
      )}
    </nav>
  );
}
