'use client';

import DatabaseMigrationSection from '@/components/admin/DatabaseMigrationSection';
import CacheSection from '@/components/admin/CacheSection';

export default function DataPage(): React.ReactElement {
  return (
    <>
      <CacheSection />
      <DatabaseMigrationSection />
    </>
  );
}
