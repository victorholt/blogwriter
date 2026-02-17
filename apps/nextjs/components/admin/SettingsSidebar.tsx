'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Key, Bot, Package, Palette, Mic, Database, FileText, Mail, Users, ClipboardList } from 'lucide-react';

const NAV_ITEMS = [
  { slug: 'api', label: 'API Config', icon: Key },
  { slug: 'agents', label: 'Agent Models', icon: Bot },
  { slug: 'products', label: 'Product API', icon: Package },
  { slug: 'themes', label: 'Themes', icon: Palette },
  { slug: 'voices', label: 'Voices', icon: Mic },
  { slug: 'cache', label: 'Cache', icon: Database },
  { slug: 'blog', label: 'Blog', icon: FileText },
  { slug: 'email', label: 'Email', icon: Mail },
  { slug: 'users', label: 'Users', icon: Users },
  { slug: 'audit', label: 'Audit', icon: ClipboardList },
] as const;

interface SettingsSidebarProps {
  basePath: string;
}

export default function SettingsSidebar({ basePath }: SettingsSidebarProps): React.ReactElement {
  const pathname = usePathname();

  // Extract current section from pathname
  const currentSection = pathname.replace(basePath, '').replace(/^\//, '') || 'api';

  return (
    <nav className="settings-sidebar">
      {NAV_ITEMS.map(({ slug, label, icon: Icon }) => {
        const isActive = currentSection === slug;
        return (
          <Link
            key={slug}
            href={`${basePath}/${slug}`}
            className={`settings-sidebar__item ${isActive ? 'settings-sidebar__item--active' : ''}`}
          >
            <Icon size={15} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
