import React, { useEffect, useState } from 'react'
import AdminApprovals from './AdminApprovals.jsx'
import AdminRegistrationApprovals from './AdminRegistrationApprovals.jsx'

export default function AdminApprovalCenter({ token, onCountsChange }) {
  const [counts, setCounts] = useState({ registrations: 0, bookings: 0 })

  useEffect(() => {
    onCountsChange?.(counts)
  }, [counts, onCountsChange])

  return (
    <div style={{display:'grid', gap:16}}>
      <AdminRegistrationApprovals
        token={token}
        onCountChange={(n) => setCounts(prev => ({ ...prev, registrations: n }))}
      />
      <div className="card" style={{padding:16}}>
        <AdminApprovals
          token={token}
          onCountChange={(n) => setCounts(prev => ({ ...prev, bookings: n }))}
        />
      </div>
    </div>
  )
}
