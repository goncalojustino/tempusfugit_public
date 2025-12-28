import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

const defaultApproveState = {
  email: '',
  lab: '',
  role: 'USER',
  allowed_nmr300: false,
  allowed_nmr400: false,
  allowed_nmr500: false,
}

export default function AdminRegistrationApprovals({ token, onCountChange }) {
  const [requests, setRequests] = useState([])
  const [labs, setLabs] = useState([])
  const [msg, setMsg] = useState('')
  const [approveOpen, setApproveOpen] = useState(false)
  const [approve, setApprove] = useState(defaultApproveState)

  const load = async () => {
    setMsg('Loading…')
    try {
      const [reqRes, labsRes] = await Promise.all([
        fetch(`${API}/admin/registration_requests`, { headers: { 'Authorization': 'Bearer ' + token } }),
        fetch(`${API}/admin/labs`, { headers: { 'Authorization': 'Bearer ' + token } }),
      ])
      const [reqJson, labsJson] = await Promise.all([reqRes.json(), labsRes.json()])
      if (!reqRes.ok) {
        setMsg(reqJson.error || 'Failed to load requests')
        setRequests([])
        onCountChange?.(0)
        return
      }
      if (!labsRes.ok) {
        setMsg(labsJson.error || 'Failed to load labs')
        setLabs([])
      } else {
        setLabs(Array.isArray(labsJson) ? labsJson : [])
      }
      const list = Array.isArray(reqJson) ? reqJson : []
      setRequests(list)
      setMsg(list.length ? '' : 'No pending registration requests')
      onCountChange?.(list.length)
    } catch (err) {
      setMsg('Failed to load registration requests')
      setRequests([])
      setLabs([])
      onCountChange?.(0)
    }
  }

  useEffect(() => {
    if (token) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function deny(email) {
    if (!email) return
    setMsg('Denying…')
    try {
      const res = await fetch(`${API}/admin/registration_requests/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || 'Failed to deny request')
        return
      }
      await load()
      setMsg('Denied')
    } catch (err) {
      setMsg('Failed to deny request')
    }
  }

  async function approveRequest(evt) {
    evt.preventDefault()
    if (approve.role === 'DANTE' && !confirm('Grant DANTE role to this user?')) return
    setMsg('Approving…')
    try {
      const body = {
        email: approve.email,
        role: approve.role,
        lab: approve.lab || '',
        allowed_nmr300: !!approve.allowed_nmr300,
        allowed_nmr400: !!approve.allowed_nmr400,
        allowed_nmr500: !!approve.allowed_nmr500,
      }
      const res = await fetch(`${API}/admin/registration_requests/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || 'Failed to approve request')
        return
      }
      setApproveOpen(false)
      await load()
      setMsg('Approved')
    } catch (err) {
      setMsg('Failed to approve request')
    }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>User registration approvals</h3>
      <p>{msg}</p>
      {requests.length ? (
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Lab</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.email}>
                <td>{r.email}</td>
                <td>{r.name || ''}</td>
                <td>{r.lab || ''}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => {
                    setApprove({
                      email: r.email,
                      lab: r.lab || '',
                      role: 'USER',
                      allowed_nmr300: false,
                      allowed_nmr400: false,
                      allowed_nmr500: false,
                    })
                    setApproveOpen(true)
                  }}>Approve</button>
                  <button className="btn secondary" onClick={() => deny(r.email)}>Deny</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="muted">No pending registration requests.</div>
      )}
      <div style={{ marginTop: 12 }}>
        <button className="btn secondary" onClick={load}>Refresh</button>
      </div>

      {approveOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'grid', placeItems: 'center', zIndex: 1100 }}>
          <div style={{ width: 520, background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0 }}>Approve registration</h3>
            <form onSubmit={approveRequest} style={{ display: 'grid', gap: 10 }}>
              <div className="muted">Email: <b>{approve.email}</b></div>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Lab</span>
                <select className="select" value={approve.lab} onChange={e => setApprove(a => ({ ...a, lab: e.target.value }))}>
                  <option value="">—</option>
                  {labs.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Role</span>
                <select className="select" value={approve.role} onChange={e => setApprove(a => ({ ...a, role: e.target.value }))}>
                  <option>USER</option>
                  <option>STAFF</option>
                  <option>DANTE</option>
                </select>
              </label>
              <fieldset>
                <legend style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Allowed resources</legend>
                <label style={{ marginRight: 10 }}>
                  <input type="checkbox" checked={!!approve.allowed_nmr300} onChange={e => setApprove(a => ({ ...a, allowed_nmr300: e.target.checked }))} /> NMR300
                </label>
                <label style={{ marginRight: 10 }}>
                  <input type="checkbox" checked={!!approve.allowed_nmr400} onChange={e => setApprove(a => ({ ...a, allowed_nmr400: e.target.checked }))} /> NMR400
                </label>
                <label>
                  <input type="checkbox" checked={!!approve.allowed_nmr500} onChange={e => setApprove(a => ({ ...a, allowed_nmr500: e.target.checked }))} /> NMR500
                </label>
              </fieldset>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn secondary" onClick={() => setApproveOpen(false)}>Cancel</button>
                <button className="btn" type="submit">Approve</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
