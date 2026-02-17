'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://blogwriter.test:4444';

interface AuditLogEntry {
  id: string;
  userId: string | null;
  spaceId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  blogsToday: number;
  blogsThisWeek: number;
  blogsThisMonth: number;
  activeUsers30d: number;
}

export default function AuditTab(): React.ReactElement {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const loadData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/audit?page=${p}`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/admin/stats`, { credentials: 'include' }),
      ]);
      const [logsData, statsData] = await Promise.all([logsRes.json(), statsRes.json()]);
      if (logsData.success && logsData.data) {
        setLogs(logsData.data.logs);
        setTotalPages(logsData.data.totalPages);
      }
      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(page); }, [page, loadData]);

  const actionLabels: Record<string, string> = {
    'user.login': 'Login',
    'user.register': 'Register',
    'blog.create': 'Blog Created',
    'blog.share': 'Blog Shared',
    'admin.user.create': 'Admin: User Created',
    'admin.user.update': 'Admin: User Updated',
    'admin.user.disable': 'Admin: User Disabled',
    'admin.user.reset-password': 'Admin: Password Reset',
  };

  return (
    <section className="settings-section">
      <h2 className="settings-section__heading" style={{ marginBottom: 16 }}>Dashboard & Audit</h2>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Users', value: stats.totalUsers },
            { label: 'Blogs Today', value: stats.blogsToday },
            { label: 'Blogs This Week', value: stats.blogsThisWeek },
            { label: 'Blogs This Month', value: stats.blogsThisMonth },
            { label: 'Active Users (30d)', value: stats.activeUsers30d },
          ].map((card) => (
            <div key={card.label} className="settings-card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-gray-800)' }}>{card.value}</div>
              <div style={{ fontSize: 12, color: 'var(--color-gray-400)', marginTop: 4 }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Log Table */}
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: 8 }}>Recent Activity</h3>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-gray-400)' }}><Loader2 size={16} className="spin" /> Loading...</p>
      ) : logs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-gray-400)' }}>No audit logs yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Time', 'Action', 'User ID', 'Resource', 'IP'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--color-gray-200)', fontSize: 11, fontWeight: 600, color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-gray-100)', fontSize: 12, color: 'var(--color-gray-400)', whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-gray-100)' }}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 100,
                      background: 'var(--color-gray-100)',
                      color: 'var(--color-gray-700)',
                      fontWeight: 500,
                    }}>
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-gray-100)', fontSize: 12, color: 'var(--color-gray-400)', fontFamily: 'monospace' }}>
                    {log.userId ? log.userId.slice(0, 8) + '...' : 'guest'}
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-gray-100)', fontSize: 12, color: 'var(--color-gray-400)' }}>
                    {log.resourceType && <>{log.resourceType}</>}
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-gray-100)', fontSize: 12, color: 'var(--color-gray-400)' }}>
                    {log.ipAddress || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="blog-dashboard__pagination" style={{ marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </section>
  );
}
