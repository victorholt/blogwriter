'use client';

import SettingsLayoutWrapper from '@/components/admin/SettingsLayout';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <SettingsLayoutWrapper>{children}</SettingsLayoutWrapper>;
}
