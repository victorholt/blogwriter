'use client';

import { useState } from 'react';
import EmailSmtpSection from '@/components/admin/EmailSmtpSection';
import EmailTemplatesSection from '@/components/admin/EmailTemplatesSection';

const TABS = [
  { id: 'config', label: 'Configuration' },
  { id: 'templates', label: 'Templates' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function EmailPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('config');

  return (
    <>
      <div className="email-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`email-tabs__tab ${activeTab === tab.id ? 'email-tabs__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && <EmailSmtpSection />}
      {activeTab === 'templates' && <EmailTemplatesSection />}
    </>
  );
}
