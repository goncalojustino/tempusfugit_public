import React, { useEffect, useState } from 'react'
import MobileNav from '../MobileNav.jsx'
import Users from './UsersMobile.jsx'
import Labs from './LabsMobile.jsx'
import Resources from './ResourcesMobile.jsx'
import Probes from './ProbesMobile.jsx'
import Experiments from './ExperimentsMobile.jsx'
import Pricing from './PricingMobile.jsx'
import Policies from './PoliciesMobile.jsx'
import Maintenance from './MaintenanceMobile.jsx'
import Training from './TrainingMobile.jsx'
import Approvals from './ApprovalsMobile.jsx'
import Broadcast from './BroadcastMobile.jsx'
import MailLog from './MailLogMobile.jsx'
import Bulletin from './BulletinMobile.jsx'
import AllBookings from './AllBookingsMobile.jsx'

const tabs = [
  {key:'USERS', label:'Users', Comp: Users},
  {key:'LABS', label:'Labs', Comp: Labs},
  {key:'RES', label:'Resources', Comp: Resources},
  {key:'PROBES', label:'Probes', Comp: Probes},
  {key:'EXPS', label:'Experiments', Comp: Experiments},
  {key:'PRICING', label:'Pricing', Comp: Pricing},
  {key:'POLICY', label:'Policies', Comp: Policies},
  {key:'MAINT', label:'Maintenance', Comp: Maintenance},
  {key:'TRAIN', label:'Training', Comp: Training},
  {key:'APPR', label:'Approvals', Comp: Approvals},
  {key:'BCAST', label:'Broadcast', Comp: Broadcast},
  {key:'MAIL', label:'Mail Log', Comp: MailLog},
  {key:'BULL', label:'Bulletin', Comp: Bulletin},
  {key:'ALL', label:'All bookings', Comp: AllBookings},
  // Reports tab can be added next; desktop has full reports
]

export default function AdminMobile({ token, role, email }){
  const [tab,setTab]=useState('USERS')
  useEffect(()=>{ localStorage.setItem('tf_view','mobile') },[])
  if(!['STAFF','DANTE'].includes(role||'')) return <div className="container"><p className="muted">Not authorized.</p></div>
  const Active = tabs.find(t=>t.key===tab)?.Comp || Users
  return (
    <div>
      <MobileNav title="Admin" role={role} />
      <div className="container">
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {tabs.map(t=> (
            <button key={t.key} className="btn" style={{background: tab===t.key?'var(--accent)':'transparent', color: tab===t.key?'#fff':'var(--accent)', borderColor:'var(--accent)'}} onClick={()=>setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <Active token={token} role={role} email={email} />
      </div>
    </div>
  )
}
