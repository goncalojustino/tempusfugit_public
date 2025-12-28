import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { AuthContext } from './contexts/AuthContext'; // Note: Corrected path
import { Button, Table, Modal, message } from 'antd';
import { ExclamationCircleOutlined, UserSwitchOutlined } from '@ant-design/icons';

const API = import.meta.env.VITE_API_URL || '/api';

// Helper to format timestamps
const formatTS = (ts) => ts ? new Date(ts).toLocaleString() : 'N/A';

// Helper to format timezone offset in minutes to UTC±HH:MM
const formatOffset = (mins) => {
  if (typeof mins !== 'number' || Number.isNaN(mins)) return 'Unknown';
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
};

// Helper to download logs as a file
function downloadLogs(email, logs, latestLogin) {
  const filename = `debug_logs_${email}_${new Date().toISOString().slice(0, 10)}.json`;
  const data = JSON.stringify({ latest_login: latestLogin, logs }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function CollapsibleSection({ title, children, defaultOpen=false }) {
  const detailProps = {};
  if (defaultOpen) detailProps.open = true;
  return (
    <details className="circle-section" {...detailProps}>
      <summary>
        <span className="circle-section-icon">!!!</span>
        <span>{title}</span>
      </summary>
      <div className="circle-section-body">
        {children}
      </div>
    </details>
  );
}


function BookingErrorAlertsPanel({ token }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [roles, setRoles] = useState([]);
  const [availableRoles, setAvailableRoles] = useState(['STAFF', 'DANTE']);
  const [subjectPrefix, setSubjectPrefix] = useState('tempusfugit UX error |');
  const [recipients, setRecipients] = useState([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API}/admin/booking_error_alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load configuration');
      setEnabled(!!data.enabled);
      setRoles(Array.isArray(data.roles) ? data.roles : []);
      setAvailableRoles(Array.isArray(data.available_roles) ? data.available_roles : ['STAFF', 'DANTE']);
      setSubjectPrefix(data.subject_prefix ? String(data.subject_prefix) : 'tempusfugit UX error |');
      setRecipients(Array.isArray(data.recipients) ? data.recipients : []);
    } catch (err) {
      setMessage(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRole = (role) => {
    setRoles((prev) => {
      role = role.toUpperCase();
      return prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${API}/admin/booking_error_alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled, roles, subject_prefix: subjectPrefix })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration');
      setEnabled(!!data.enabled);
      setRoles(Array.isArray(data.roles) ? data.roles : []);
      setAvailableRoles(Array.isArray(data.available_roles) ? data.available_roles : ['STAFF', 'DANTE']);
      setSubjectPrefix(data.subject_prefix ? String(data.subject_prefix) : 'tempusfugit UX error |');
      setRecipients(Array.isArray(data.recipients) ? data.recipients : []);
      setMessage('Saved.');
    } catch (err) {
      setMessage(String(err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={loading || saving}
          />
          Enable booking error alerts
        </label>
        {loading && <span className="muted">Loading…</span>}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        When enabled, every failed booking attempt emails the selected roles with the full error payload
        (user, resource, times, probe, and the message shown to the user).
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Mail subject prefix</label>
        <input
          type="text"
          value={subjectPrefix}
          onChange={(e) => setSubjectPrefix(e.target.value)}
          disabled={saving || loading}
          placeholder="tempusfugit UX error |"
          style={{ maxWidth: 380, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
        />
        <div className="muted">Final subject: {(subjectPrefix || 'tempusfugit UX error |')} YYYYMMDDhhmmss</div>
      </div>
      <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
        <legend style={{ fontSize: 13, fontWeight: 600 }}>Notify roles</legend>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {availableRoles.map((role) => (
            <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={() => toggleRole(role)}
                disabled={saving || loading}
              />
              {role}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <button className="btn" onClick={save} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
      {message && (
        <div style={{ color: message.includes('Saved') ? 'var(--c-teal-500)' : '#b91c1c' }}>{message}</div>
      )}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Active recipients</div>
        {recipients.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {recipients.map((r) => (
              <li key={r.email} style={{ fontSize: 13 }}>
                {r.email} · {r.role}
              </li>
            ))}
          </ul>
        ) : (
          <div className="muted">No recipients (either disabled or no users with the selected roles).</div>
        )}
      </div>
    </div>
  );
}


// Component to view logs for a single user
function LogViewer({ token, userEmail, onBack, role }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50); // 50 logs per page
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loginMeta, setLoginMeta] = useState(null);

  const fetchLogs = useCallback(async (currentOffset) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/debug/logs?email=${encodeURIComponent(userEmail)}&limit=${limit}&offset=${currentOffset}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch logs');
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setOffset(currentOffset);
      setLoginMeta(data.latest_login || null);
    } catch (e) {
      setError(e.message);
    } finally {
        setLoading(false);
      }
  }, [userEmail, token, limit]);

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  const handleClearLogs = async () => {
    if (!confirm(`Are you sure you want to clear all ${total} logs for ${userEmail}? This cannot be undone.`)) return;
    setError('');
    try {
      const res = await fetch(`${API}/admin/debug/logs/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: userEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear logs');
      fetchLogs(0); // Refresh logs
    } catch (e) {
      setError(e.message);
    }
  };
  
  const handleDownload = () => {
    downloadLogs(userEmail, logs, loginMeta);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Debug Logs for {userEmail}</h3>
        <button className="btn secondary" onClick={onBack}>&larr; Back to List</button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => fetchLogs(0)} disabled={loading}>Refresh</button>
        <button className="btn secondary" onClick={handleDownload} disabled={loading || logs.length === 0}>Download Page</button>
        {role === 'DANTE' && <button className="btn danger" onClick={handleClearLogs} disabled={loading || total === 0}>Clear All Logs</button>}
        <span className="muted">Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}</span>
      </div>

      {loginMeta ? (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h4 style={{ marginTop: 0, marginBottom: 8 }}>Latest Login Metadata</h4>
          <div style={{ display: 'grid', gap: 4 }}>
            <span><strong>Recorded at:</strong> {formatTS(loginMeta.created_at)}</span>
            <span><strong>Client local time (reported):</strong> {formatTS(loginMeta.client_time_iso)}</span>
            <span><strong>Timezone:</strong> {loginMeta.tz_name || 'Unknown'} ({formatOffset(loginMeta.tz_offset_minutes)})</span>
            <span><strong>IP:</strong> {loginMeta.ip || 'Unknown'}</span>
            <span><strong>User agent:</strong> {loginMeta.user_agent || 'Unknown'}</span>
            <span><strong>Accept-Language:</strong> {loginMeta.accept_language || 'Unknown'}</span>
          </div>
          {loginMeta.payload ? (
            <details style={{ marginTop: 8 }}>
              <summary>View raw client payload</summary>
              <pre style={{ background: '#f3f4f6', padding: 8, borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
                {JSON.stringify(loginMeta.payload, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : (!loading ? (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <span className="muted">No login metadata captured for this user yet.</span>
        </div>
      ) : null)}

      {error && <p className="error">{error}</p>}
      {loading && <p>Loading logs...</p>}

      {!loading && logs.length === 0 && <p>No logs found for this user.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {logs.map(log => (
          <details key={log.id} className="log-entry">
            <summary>
              <span className="log-ts">{formatTS(log.log_ts)}</span>
              <span className={`log-method log-method-${log.method}`}>{log.method}</span>
              <span className="log-path">{log.path}</span>
              <span className={`log-status log-status-${Math.floor(log.status_code / 100)}xx`}>{log.status_code}</span>
            </summary>
            <div className="log-details">
              <p><strong>IP:</strong> {log.ip}</p>
              <p><strong>User Agent:</strong> {log.user_agent}</p>
              <h4>Request Payload</h4>
              <pre>{JSON.stringify(log.request_payload, null, 2) || 'null'}</pre>
              <h4>Response Payload</h4>
              <pre>{JSON.stringify(log.response_payload, null, 2) || 'null'}</pre>
            </div>
          </details>
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button className="btn" onClick={() => fetchLogs(offset - limit)} disabled={offset === 0 || loading}>Previous</button>
        <button className="btn" onClick={() => fetchLogs(offset + limit)} disabled={offset + limit >= total || loading}>Next</button>
      </div>
      
      <style>{`
        .log-entry { border: 1px solid #ddd; border-radius: 4px; }
        .log-entry summary { padding: 8px; cursor: pointer; display: flex; gap: 12px; align-items: center; background: #f9f9f9; }
        .log-entry summary:hover { background: #f1f1f1; }
        .log-ts { font-family: monospace; font-size: 0.9em; color: #555; }
        .log-method { font-weight: bold; font-family: monospace; padding: 2px 6px; border-radius: 4px; color: white; }
        .log-method-GET { background-color: #28a745; }
        .log-method-POST { background-color: #007bff; }
        .log-method-DELETE { background-color: #dc3545; }
        .log-path { font-family: monospace; color: #333; flex-grow: 1; }
        .log-status { font-weight: bold; }
        .log-status-2xx { color: #28a745; }
        .log-status-3xx { color: #ffc107; }
        .log-status-4xx { color: #fd7e14; }
        .log-status-5xx { color: #dc3545; }
        .log-details { padding: 16px; border-top: 1px solid #ddd; background: #fff; }
        .log-details h4 { margin-top: 12px; margin-bottom: 4px; }
        .log-details pre { background: #eee; padding: 8px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow-y: auto; }
      `}</style>
    </div>
  );
}


// Main component for the Debug Panel
function DebugPanel({ token, user }) {
  const [debugUsers, setDebugUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [duration, setDuration] = useState(24);
  const [viewingUser, setViewingUser] = useState(null);

  const fetchDebugUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/debug/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      setDebugUsers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user.role === 'DANTE' || user.role === 'STAFF') {
      fetchDebugUsers();
    }
  }, [fetchDebugUsers, user.role]);

  const handleStartDebug = async (e) => {
    e.preventDefault();
    if (!newUserEmail) return;
    setError('');
    try {
      const res = await fetch(`${API}/admin/debug/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: newUserEmail, duration_hours: duration })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start debugging');
      setNewUserEmail('');
      fetchDebugUsers(); // Refresh the list
    } catch (e) {
      setError(e.message);
    }
  };

  const handleStopDebug = async (email) => {
    if (!confirm(`Are you sure you want to stop debugging for ${email}?`)) return;
    setError('');
    try {
      const res = await fetch(`${API}/admin/debug/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to stop debugging');
      fetchDebugUsers(); // Refresh the list
    } catch (e) {
      setError(e.message);
    }
  };

  if (viewingUser) {
    return <LogViewer token={token} userEmail={viewingUser} onBack={() => setViewingUser(null)} role={user.role} />;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h2>User Debug Panel</h2>
      <p className="muted">This panel allows you to capture all server-side activity for a specific user for troubleshooting purposes.</p>
      {user.role === 'DANTE' && (
        <form onSubmit={handleStartDebug} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <input
            type="email"
            placeholder="user@example.com"
            value={newUserEmail}
            onChange={e => setNewUserEmail(e.target.value)}
            required
            style={{ flexGrow: 1 }}
          />
          <label>
            Duration (hours):
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              min="1"
              max="168" // 1 week
              style={{ width: 80, marginLeft: 8 }}
            />
          </label>
          <button type="submit" className="btn">Start Debugging</button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      <h3>Currently Debugged Users</h3>
      {loading && <p>Loading...</p>}
      {!loading && debugUsers.length === 0 && <p>No users are currently being debugged.</p>}
      
      <table className="table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Expires At</th>
            <th>Added By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {debugUsers.map(u => (
            <tr key={u.email}>
              <td>{u.email}</td>
              <td>{formatTS(u.expires_at)}</td>
              <td>{u.added_by}</td>
              <td>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => setViewingUser(u.email)}>View Logs</button>
                  {user.role === 'DANTE' && <button className="btn secondary" onClick={() => handleStopDebug(u.email)}>Stop</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImpersonationPanel({token, user}) {
    const normalizeRole = useCallback((role) => String(role || '').trim().toUpperCase(), []);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { impersonate } = useContext(AuthContext);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
            setUsers(data);
        } catch (error) {
            message.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user.role === 'DANTE' || user.role === 'STAFF') {
            fetchUsers();
        }
    }, [user.role]);

    const impersonationTargets = useMemo(() => {
        const myEmail = (user.email || '').toLowerCase();
        const normalizedRole = normalizeRole(user.role);
        return users.filter((u) => {
            const targetRole = normalizeRole(u.role);
            if ((u.email || '').toLowerCase() === myEmail) return false;
            if (normalizedRole === 'DANTE') {
                return ['USER', 'STAFF'].includes(targetRole);
            }
            // Staff can only impersonate regular users
            return targetRole === 'USER';
        });
    }, [users, user.email, user.role, normalizeRole]);

    const handleImpersonate = (targetUser) => {
        Modal.confirm({
            title: `Impersonate ${targetUser.name || targetUser.email}?`,
            icon: <ExclamationCircleOutlined />,
            content: 'You will be logged in as this user and will be able to perform actions on their behalf. All actions will be audited.',
            onOk: async () => {
                try {
                    await impersonate(targetUser.email);
                } catch (error) {
                    const msg = error.response?.data?.error || 'Failed to start impersonation';
                    message.error(msg);
                }
            },
        });
    };

    const columns = [
        { title: 'Email', dataIndex: 'email', key: 'email', sorter: (a, b) => a.email.localeCompare(b.email) },
        { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => (a.name || '').localeCompare(b.name || '') },
        { title: 'Role', dataIndex: 'role', key: 'role', sorter: (a, b) => a.role.localeCompare(b.role) },
        { title: 'Lab', dataIndex: 'lab', key: 'lab', sorter: (a, b) => (a.lab || '').localeCompare(b.lab || '') },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                user?.role === 'DANTE' && user.email !== record.email && (
                    <Button
                        icon={<UserSwitchOutlined />}
                        onClick={() => handleImpersonate(record)}
                    >
                        Impersonate
                    </Button>
                )
            ),
        },
    ];

    return (
        <div style={{ marginTop: 24 }}>
            <h2>Impersonation</h2>
            <p className="muted">This panel allows you to impersonate another user. This feature is restricted to DANTE administrators.</p>
            <Table
                dataSource={impersonationTargets}
                columns={columns}
                rowKey="email"
                loading={loading}
                pagination={{ pageSize: 10 }}
            />
        </div>
    );
}


export default function AdminNineCirclesOfHell({ token, user, defaultSection }) {
    if (user.role !== 'DANTE' && user.role !== 'STAFF') {
        return null;
    }

    const normalizedSection = typeof defaultSection === 'string' ? defaultSection.toUpperCase() : ''

    return (
        <div>
            <h1>The Nine Circles of Hell</h1>
            <p>Special circles for special people.</p>
            <style>{`
              .circle-section {
                border: 1px solid #7f1d1d;
                margin: 20px 0;
                border-radius: 12px;
                background: linear-gradient(130deg, rgba(30, 7, 7, 0.95) 0%, rgba(69, 10, 10, 0.9) 60%, rgba(124, 45, 18, 0.85) 100%);
                box-shadow: 0 12px 30px rgba(15, 23, 42, 0.4);
                color: #fef3c7;
                overflow: hidden;
              }
              .circle-section > summary {
                cursor: pointer;
                padding: 14px 18px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
                list-style: none;
              }
              .circle-section > summary::-webkit-details-marker {
                display: none;
              }
              .circle-section > summary::after {
                content: 'v';
                margin-left: auto;
                font-size: 12px;
                transition: transform 0.2s ease;
              }
              .circle-section[open] > summary::after {
                transform: rotate(-180deg);
              }
              .circle-section-body {
                background: #ffffff;
                color: #111827;
                padding: 18px;
              }
              .circle-section-icon {
                display: inline-flex;
                width: 32px;
                height: 32px;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: rgba(254, 243, 199, 0.12);
                border: 1px solid rgba(248, 113, 113, 0.4);
                color: #f97316;
                font-weight: 700;
                font-size: 12px;
              }
            `}</style>
            <CollapsibleSection title="Tenth Circle: Impersonation Toolkit" defaultOpen={normalizedSection==='TEN'}>
              <ImpersonationPanel token={token} user={user} />
            </CollapsibleSection>
            <CollapsibleSection title="Eleventh Circile: Booking error alerts" defaultOpen={normalizedSection==='ELEVEN'}>
              <BookingErrorAlertsPanel token={token} />
            </CollapsibleSection>
            <CollapsibleSection title="Twelfth Circle: User Debugging" defaultOpen={normalizedSection==='TWELVE'}>
              <DebugPanel token={token} user={user} />
            </CollapsibleSection>
            <CollapsibleSection title="Thirteenth Circle: Backup Operations" defaultOpen={normalizedSection==='THIRTEEN'}>
              <div style={{display:'grid',gap:12}}>
                <p className="muted" style={{margin:0}}>
                  Launch the backup console to inspect daily snapshots, run ad-hoc backups, or restore
                  the live environment. The console runs on host port 8081.
                </p>
                <div>
                  <a
                    href="<CHANGE:YOUR_BACKUP_CONSOLE_URL_HERE>"
                    target="_blank"
                    rel="noreferrer"
                    className="btn"
                    style={{display:'inline-flex',alignItems:'center',gap:8}}
                  >
                    Open backup console
                  </a>
                </div>
              </div>
            </CollapsibleSection>
        </div>
    )
}
