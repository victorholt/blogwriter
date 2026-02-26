const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export interface DocsNavItem {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
  sortOrder: number;
  isDefault: boolean;
}

export interface DocsPage extends DocsNavItem {
  content: string;
  updatedAt: string;
  updatedBy: string | null;
}

export async function fetchDocsNav(): Promise<DocsNavItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/docs`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.success ? (json.data as DocsNavItem[]) : [];
  } catch {
    return [];
  }
}

export async function fetchDocsPage(slug: string): Promise<DocsPage | null> {
  try {
    const res = await fetch(`${API_BASE}/api/docs/${slug}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? (json.data as DocsPage) : null;
  } catch {
    return null;
  }
}
