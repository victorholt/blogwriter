'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import UserSidebar from '@/components/user/UserSidebar';

export default function MyLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <div className="blog-dashboard"><p className="blog-dashboard__loading">Loading...</p></div>;
  }

  if (!isAuthenticated) {
    return <div className="blog-dashboard"><p className="blog-dashboard__loading">Redirecting...</p></div>;
  }

  return (
    <div className="user-area">
      <UserSidebar />
      <div className="user-area__content">
        {children}
      </div>
    </div>
  );
}
