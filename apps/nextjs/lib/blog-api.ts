import type { ApiResponse } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://blogwriter.test:4444';

export interface BlogListItem {
  id: string;
  title: string | null;
  status: string;
  brandLabelSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlogDressInfo {
  imageUrl: string;
  designer: string;
  styleId: string;
}

export interface BlogDetail {
  id: string;
  title: string | null;
  status: string;
  brandLabelSlug: string | null;
  generatedBlog: string | null;
  seoMetadata: { title: string; description: string; keywords: string[] } | null;
  review: { qualityScore: number; strengths: string[]; suggestions: string[]; flags: string[] } | null;
  dresses?: BlogDressInfo[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchMyBlogs(page = 1): Promise<ApiResponse<{ blogs: BlogListItem[]; total: number; page: number; totalPages: number }>> {
  const res = await fetch(`${API_BASE}/api/blogs?page=${page}`, {
    credentials: 'include',
  });
  return res.json();
}

export async function fetchBlog(id: string): Promise<ApiResponse<BlogDetail>> {
  const res = await fetch(`${API_BASE}/api/blogs/${id}`, {
    credentials: 'include',
  });
  return res.json();
}

export async function updateBlogTitle(id: string, title: string): Promise<ApiResponse<void>> {
  const res = await fetch(`${API_BASE}/api/blogs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title }),
  });
  return res.json();
}

export interface BlogDebugData {
  agentOutputs: Record<string, string>;
  blogTraceIds: Record<string, string>;
  pipeline: { id: string; label: string }[];
}

export async function fetchBlogDebugData(id: string): Promise<ApiResponse<BlogDebugData>> {
  const res = await fetch(`${API_BASE}/api/blogs/${id}/debug`, {
    credentials: 'include',
  });
  return res.json();
}

export async function deleteBlog(id: string): Promise<ApiResponse<void>> {
  const res = await fetch(`${API_BASE}/api/blogs/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
}
