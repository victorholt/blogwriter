'use client';

import { useState, useEffect } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { fetchBrandLabels } from '@/lib/api';
import type { BrandLabel } from '@/types';

export default function BrandSelector(): React.ReactElement {
  const [brands, setBrands] = useState<BrandLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedBrandSlug = useWizardStore((s) => s.selectedBrandSlug);
  const setSelectedBrand = useWizardStore((s) => s.setSelectedBrand);

  useEffect(() => {
    fetchBrandLabels().then((res) => {
      if (res.success && res.data) setBrands(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="brand-selector__loading">Loading brands...</div>;
  if (brands.length === 0) return <></>;

  return (
    <div className="brand-selector">
      <label className="brand-selector__label">Brand</label>
      <div className="brand-selector__pills">
        <button
          type="button"
          className={`brand-selector__pill ${selectedBrandSlug === null ? 'brand-selector__pill--active' : ''}`}
          onClick={() => setSelectedBrand(null)}
        >
          All Brands
        </button>
        {brands.map((brand) => (
          <button
            key={brand.slug}
            type="button"
            className={`brand-selector__pill ${selectedBrandSlug === brand.slug ? 'brand-selector__pill--active' : ''}`}
            onClick={() => setSelectedBrand(brand.slug)}
          >
            {brand.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}
