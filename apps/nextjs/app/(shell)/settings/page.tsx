'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/general');
  }, [router]);

  return <></>;
}
