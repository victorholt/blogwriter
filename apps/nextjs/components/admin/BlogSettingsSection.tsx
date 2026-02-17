'use client';

import { FileText } from 'lucide-react';
import { updateSettings } from '@/lib/admin-api';
import Toggle from '@/components/ui/Toggle';
import SearchSelect from '@/components/ui/SearchSelect';
import type { SearchSelectGroup } from '@/components/ui/SearchSelect';
import { useSettings } from './SettingsContext';

const TIMELINE_STYLE_OPTIONS: SearchSelectGroup[] = [
  {
    label: 'Display Styles',
    options: [
      { label: 'Preview Bar', value: 'preview-bar' },
      { label: 'Vertical Timeline', value: 'timeline' },
      { label: 'Horizontal Stepper', value: 'stepper' },
    ],
  },
];

export default function BlogSettingsSection(): React.ReactElement {
  const { allSettings, setAllSettings } = useSettings();

  async function handleToggle(key: string, currentlyOn: boolean): Promise<void> {
    const newValue = currentlyOn ? 'false' : 'true';
    const result = await updateSettings({ [key]: newValue });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
    }
  }

  async function handleTimelineStyleChange(value: string): Promise<void> {
    const result = await updateSettings({ blog_timeline_style: value });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__heading">
        <FileText size={18} />
        Blog Settings
      </h2>

      <div className="settings-card">
        <div className="settings-field">
          <label className="settings-field__label">Generation Timeline Style</label>
          <p className="settings-field__current" style={{ fontFamily: 'inherit' }}>
            Controls how blog generation progress is displayed to users.
          </p>
          <SearchSelect
            value={allSettings.blog_timeline_style || 'preview-bar'}
            onChange={handleTimelineStyleChange}
            groups={TIMELINE_STYLE_OPTIONS}
            placeholder="Select display style..."
          />
        </div>
      </div>

      <div className="settings-card">
        <Toggle
          checked={allSettings.blog_generate_images !== 'false'}
          onChange={() => handleToggle('blog_generate_images', allSettings.blog_generate_images !== 'false')}
          label="Generate Images"
          description="When disabled, blog posts will not include dress images."
        />
      </div>

      <div className="settings-card">
        <Toggle
          checked={allSettings.blog_generate_links !== 'false'}
          onChange={() => handleToggle('blog_generate_links', allSettings.blog_generate_links !== 'false')}
          label="Generate Links"
          description="When disabled, blog posts will not include hyperlinks."
        />
      </div>

      <div className="settings-card">
        <Toggle
          checked={allSettings.blog_sharing_enabled === 'true'}
          onChange={() => handleToggle('blog_sharing_enabled', allSettings.blog_sharing_enabled === 'true')}
          label="Blog Sharing"
          description="When enabled, users can create public share links for generated blog posts."
        />
      </div>
    </section>
  );
}
