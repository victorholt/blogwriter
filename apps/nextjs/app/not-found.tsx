import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound(): React.ReactElement {
  return (
    <div className="page-shell">
      <div className="paper">
        <div className="status-page">
          <div className="status-page__icon status-page__icon--not-found">
            <FileQuestion size={36} strokeWidth={1.5} />
          </div>
          <h1 className="status-page__title">Page Not Found</h1>
          <p className="status-page__text">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="status-page__actions">
            <Link href="/" className="btn btn--primary">
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
