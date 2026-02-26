'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Key, Bot, Package, Palette, Mic, Database, FileText, Mail, Users, ClipboardList, MessageSquare, Image } from 'lucide-react';

const NAV_ITEMS = [
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
  { slug: 'media', label: 'Media', icon: Image },
  { slug: 'audit', label: 'Audit', icon: ClipboardList },
  { slug: 'data', label: 'Data', icon: Database },
] as const;

interface SettingsSidebarProps {
  basePath: string;
}

export default function SettingsSidebar({ basePath }: SettingsSidebarProps): React.ReactElement {
  const pathname = usePathname();

  // Extract current section from pathname
  const currentSection = pathname.replace(basePath, '').replace(/^\//, '') || 'general';

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
