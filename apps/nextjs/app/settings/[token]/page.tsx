'use client';

import { use } from 'react';
import SettingsPage from '@/components/admin/SettingsPage';

export default function AdminSettingsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): React.ReactElement {
  const { token } = use(params);
  return <SettingsPage token={token} />;
}
