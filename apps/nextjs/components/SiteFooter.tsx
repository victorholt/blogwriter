'use client';

import Link from 'next/link';
import { useAppSettingsStore } from '@/stores/app-settings-store';

export default function SiteFooter(): React.ReactElement {
  const appName = useAppSettingsStore((s) => s.appName);
  const feedbackEnabled = useAppSettingsStore((s) => s.feedbackEnabled);
  const docsEnabled = useAppSettingsStore((s) => s.docsEnabled);

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <span className="site-footer__copy">
          &copy; {new Date().getFullYear()} {appName}
        </span>
        {docsEnabled && (
          <>
            <span className="site-footer__sep">&middot;</span>
            <Link href="/docs" className="site-footer__link">Docs</Link>
          </>
        )}
        <span className="site-footer__sep">&middot;</span>
        <Link href="/privacy" className="site-footer__link">Privacy</Link>
        <span className="site-footer__sep">&middot;</span>
        <Link href="/terms" className="site-footer__link">Terms</Link>
        {feedbackEnabled && (
          <>
            <span className="site-footer__sep">&middot;</span>
            <Link href="/feedback" className="site-footer__link">Share Feedback</Link>
          </>
        )}
      </div>
    </footer>
  );
}
