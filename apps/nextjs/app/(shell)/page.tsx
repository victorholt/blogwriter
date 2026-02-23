'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export default function HomePage(): React.ReactElement {
  const router = useRouter();
  const { isAuthenticated, isLoading, guestModeEnabled } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      router.replace('/my/blogs');
    } else if (guestModeEnabled) {
      router.replace('/new');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, guestModeEnabled, router]);

  return <div />;
}
