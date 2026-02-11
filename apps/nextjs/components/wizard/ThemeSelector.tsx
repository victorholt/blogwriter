'use client';

import { useState, useEffect } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { fetchThemes } from '@/lib/api';
import type { Theme } from '@/types';

export default function ThemeSelector(): React.ReactElement {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedThemeId = useWizardStore((s) => s.selectedThemeId);
  const setSelectedTheme = useWizardStore((s) => s.setSelectedTheme);

  useEffect(() => {
    fetchThemes().then((res) => {
      if (res.success && res.data) setThemes(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="theme-selector__loading">Loading themes...</div>;
  if (themes.length === 0) return <></>;

  return (
    <div className="theme-selector">
      <label className="theme-selector__label">Theme</label>
      <div className="theme-selector__pills">
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`theme-selector__pill ${selectedThemeId === theme.id ? 'theme-selector__pill--active' : ''}`}
            onClick={() => setSelectedTheme(selectedThemeId === theme.id ? null : theme.id)}
          >
            {theme.name}
          </button>
        ))}
      </div>
    </div>
  );
}
