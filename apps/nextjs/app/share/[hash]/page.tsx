'use client';

import { use } from 'react';
import SharedBlogView from '@/components/SharedBlogView';

export default function SharePage({
  params,
}: {
  params: Promise<{ hash: string }>;
}): React.ReactElement {
  const { hash } = use(params);
  return <SharedBlogView hash={hash} />;
}
