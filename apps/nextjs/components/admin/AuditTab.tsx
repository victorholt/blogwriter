'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, X } from 'lucide-react';
import SearchSelect, { type SearchSelectGroup } from '@/components/ui/SearchSelect';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://blogwriter.test:4444';

interface AuditLogEntry {
  id: string;
  userId: string | null;
  spaceId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: string | null;
  createdAt: string;
  userDisplayName: string | null;
  userEmail: string | null;
  userStoreCode: string | null;
}

interface Stats {
  totalUsers: number;
  blogsToday: number;
  blogsThisWeek: number;
  blogsThisMonth: number;
  activeUsers30d: number;
}

interface UserOption {
  id: string;
  email: string;
  displayName: string;
}

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

export default function AuditTab(): React.ReactElement {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [storeCodeFilter, setStoreCodeFilter] = useState('');
  const [filterOptions, setFilterOptions] = useState<{ actions: string[]; resourceTypes: string[]; storeCodes: string[] }>({
    actions: [],
    resourceTypes: [],
    storeCodes: [],
  });
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  // Fetch filter options once on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/admin/audit/filters`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setFilterOptions({
            actions: data.data.actions || [],
            resourceTypes: data.data.resourceTypes || [],
            storeCodes: data.data.storeCodes || [],
          });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch users for user filter dropdown
  useEffect(() => {
    fetch(`${API_BASE}/api/admin/users?limit=100`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data?.users) {
          setUserOptions(data.data.users.map((u: UserOption) => ({ id: u.id, email: u.email, displayName: u.displayName })));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch stats once on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/admin/stats`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) setStats(data.data);
      })
      .catch(() => {});
  }, []);

  // Fetch logs when page or filters change
  const loadLogs = useCallback(async (p: number, action: string, resourceType: string, userId: string, storeCode: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (action) params.set('action', action);
      if (resourceType) params.set('resourceType', resourceType);
      if (userId) params.set('userId', userId);
      if (storeCode) params.set('storeCode', storeCode);

      const res = await fetch(`${API_BASE}/api/admin/audit?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data) {
        setLogs(data.data.logs);
        setTotalPages(data.data.totalPages);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLogs(page, actionFilter, resourceTypeFilter, userFilter, storeCodeFilter);
  }, [page, actionFilter, resourceTypeFilter, userFilter, storeCodeFilter, loadLogs]);

  // Build SearchSelect groups
  const actionGroups: SearchSelectGroup[] = filterOptions.actions.length > 0
    ? [{ label: 'Actions', options: [{ label: 'All Actions', value: '' }, ...filterOptions.actions.map((a) => ({ label: actionLabels[a] || a, value: a }))] }]
    : [];

  const resourceTypeGroups: SearchSelectGroup[] = filterOptions.resourceTypes.length > 0
    ? [{ label: 'Resource Types', options: [{ label: 'All Resources', value: '' }, ...filterOptions.resourceTypes.map((r) => ({ label: r, value: r }))] }]
    : [];

  const userGroups: SearchSelectGroup[] = userOptions.length > 0
    ? [{
        label: 'Users',
        options: [
          { label: 'All Users', value: '' },
          { label: 'Guest', value: 'guest' },
          ...userOptions.map((u) => ({ label: u.displayName, value: u.id })),
        ],
      }]
    : [{ label: 'Users', options: [{ label: 'All Users', value: '' }, { label: 'Guest', value: 'guest' }] }];

  const storeCodeGroups: SearchSelectGroup[] = [
    {
      label: 'Store Code',
      options: [
        { label: 'All Codes', value: '' },
        { label: 'No store code', value: '__none__' },
        ...filterOptions.storeCodes.map((c) => ({ label: c, value: c })),
      ],
    },
  ];

  const hasActiveFilters = actionFilter !== '' || resourceTypeFilter !== '' || userFilter !== '' || storeCodeFilter !== '';

  function clearFilters(): void {
    setActionFilter('');
    setResourceTypeFilter('');
    setUserFilter('');
    setStoreCodeFilter('');
    setPage(1);
  }

  function handleActionChange(val: string): void { setActionFilter(val); setPage(1); }
  function handleResourceTypeChange(val: string): void { setResourceTypeFilter(val); setPage(1); }
  function handleUserChange(val: string): void { setUserFilter(val); setPage(1); }
  function handleStoreCodeChange(val: string): void { setStoreCodeFilter(val); setPage(1); }

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

      {/* Filters */}
      <div className="audit-filters">
        {actionGroups.length > 0 && (
          <div className="audit-filters__field">
            <span className="audit-filters__label">Action</span>
            <SearchSelect
              value={actionFilter}
              onChange={handleActionChange}
              groups={actionGroups}
              placeholder="All Actions"
            />
          </div>
        )}
        <div className="audit-filters__field">
          <span className="audit-filters__label">User</span>
          <SearchSelect
            value={userFilter}
            onChange={handleUserChange}
            groups={userGroups}
            placeholder="All Users"
          />
        </div>
        <div className="audit-filters__field">
          <span className="audit-filters__label">Store Code</span>
          <SearchSelect
            value={storeCodeFilter}
            onChange={handleStoreCodeChange}
            groups={storeCodeGroups}
            placeholder="All Codes"
          />
        </div>
        {resourceTypeGroups.length > 0 && (
          <div className="audit-filters__field">
            <span className="audit-filters__label">Resource Type</span>
            <SearchSelect
              value={resourceTypeFilter}
              onChange={handleResourceTypeChange}
              groups={resourceTypeGroups}
              placeholder="All Resources"
            />
          </div>
        )}
        {hasActiveFilters && (
          <button className="audit-filters__clear" onClick={clearFilters} title="Clear filters" aria-label="Clear filters">
            <X size={16} />
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-gray-400)' }}><Loader2 size={16} className="spin" /> Loading...</p>
      ) : logs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-gray-400)' }}>
          {hasActiveFilters ? 'No audit logs matching filters.' : 'No audit logs yet.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Time', 'Action', 'User', 'Resource', 'Store Code'].map((h) => (
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
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-gray-100)', fontSize: 12, color: 'var(--color-gray-400)' }}>
                    {log.userDisplayName || log.userEmail || 'guest'}
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-gray-100)', fontSize: 12, color: 'var(--color-gray-400)' }}>
                    {log.resourceType || ''}
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-gray-100)', fontSize: 12, color: 'var(--color-gray-400)', fontFamily: 'monospace', fontWeight: 600 }}>
                    {log.userStoreCode || '—'}
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
