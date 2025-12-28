import React, { useState, useEffect, useCallback } from 'react'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import AdminLabs from './AdminLabs.jsx'
import AdminClients from './AdminClients.jsx'
import AdminResources from './AdminResources.jsx'
import AdminReports from './AdminReports.jsx'
import AdminPricing from './AdminPricing.jsx'
import AdminUsers from './AdminUsers.jsx'
import AdminPolicies from './AdminPolicies.jsx'
import AdminProbes from './AdminProbes.jsx'
import AdminExperiments from './AdminExperiments.jsx'
import AdminBroadcast from './AdminBroadcast.jsx'
import AdminMaintenance from './AdminMaintenance.jsx'
import AdminTraining from './AdminTraining.jsx'
import AdminBulletin from './AdminBulletin.jsx'
import AdminAllBookings from './AdminAllBookings.jsx'
import AdminMailLog from './AdminMailLog.jsx'
import AdminLogo from './AdminLogo.jsx'
import AdminNineCirclesOfHell from './AdminNineCirclesOfHell.jsx'
import AdminSlotColors from './AdminSlotColors.jsx'
import AdminApprovalCenter from './AdminApprovalCenter.jsx'

const CIRCLE_SECTION_BY_TAB = {
  NINE_CIRCLES_TEN: 'TEN',
  NINE_CIRCLES_ELEVEN: 'ELEVEN',
  NINE_CIRCLES_TWELVE: 'TWELVE',
  NINE_CIRCLES_THIRTEEN: 'THIRTEEN'
}

const API = import.meta.env.VITE_API_URL || '/api'


class Boundary extends React.Component{
  constructor(p){ super(p); this.state={err:null} }
  static getDerivedStateFromError(err){ return {err} }
  componentDidCatch(err,info){ console.error('Admin crash:',err,info) }
  render(){ return this.state.err ? <div style={{padding:16,color:'#b91c1c'}}>Admin error: {String(this.state.err)}</div> : this.props.children }
}

export default function Admin({token,email,role,onLogout}){
  const [tab,setTab] = useState('USERS') // APPROVALS | USERS | CONFIG | APPROVALS_MAILS | ALL_BOOKINGS | REPORTS | NINE_CIRCLES
  const [pendingCounts,setPendingCounts] = useState({ registrations:0, bookings:0 })

  const refreshPendingCounts = useCallback(async () => {
    if(!token){ setPendingCounts({ registrations:0, bookings:0 }); return }
    try{
      const headers = { 'Authorization': 'Bearer ' + token }
      const [regRes, bookRes] = await Promise.all([
        fetch(`${API}/admin/registration_requests`, { headers }),
        fetch(`${API}/admin/reservations/pending`, { headers }),
      ])
      let registrations = 0
      let bookings = 0
      if(regRes.ok){
        const payload = await regRes.json()
        registrations = Array.isArray(payload) ? payload.length : 0
      } else {
        await regRes.text()
      }
      if(bookRes.ok){
        const payload = await bookRes.json()
        bookings = Array.isArray(payload) ? payload.length : 0
      } else {
        await bookRes.text()
      }
      setPendingCounts({ registrations, bookings })
    }catch(_){
      setPendingCounts({ registrations:0, bookings:0 })
    }
  },[token])

  // optional: allow hash-based deep-linking like #CONFIG
  useEffect(()=>{
    const h = (window.location.hash||'').replace('#','').toUpperCase()
    const allowedTabs = ['APPROVALS','USERS','CONFIG','APPROVALS_MAILS','ALL_BOOKINGS','REPORTS','NINE_CIRCLES','NINE_CIRCLES_TEN','NINE_CIRCLES_ELEVEN','NINE_CIRCLES_TWELVE','NINE_CIRCLES_THIRTEEN']
    if(allowedTabs.includes(h)) setTab(h)
  },[])
  useEffect(()=>{
    try{ window.location.hash = tab }catch(_){ }
  },[tab])
  useEffect(()=>{ refreshPendingCounts() },[refreshPendingCounts])

  if(!token) return <p>Not signed in.</p>
  const totalPending = pendingCounts.bookings + pendingCounts.registrations
  const tabsConfig = [
    {key:'APPROVALS',        label:'Approvals', needsAttention: totalPending>0},
    {key:'USERS',           label:'Users & Labs'},
    {key:'CONFIG',          label:'Resources & Pricing'},
    {key:'APPROVALS_MAILS', label:'Mail & Bulletin'},
    {key:'ALL_BOOKINGS',    label:'All bookings'},
    {key:'REPORTS',         label:'Reports'},
    ...(role==='DANTE' || role==='STAFF'
      ? [
          { key:'NINE_CIRCLES', label:'Nine Circles' },
          { key:'NINE_CIRCLES_TEN', label:'10th: impersonate' },
          { key:'NINE_CIRCLES_ELEVEN', label:'11th: UX errors' },
          { key:'NINE_CIRCLES_TWELVE', label:'12th: debug users' },
          { key:'NINE_CIRCLES_THIRTEEN', label:'13th: backup & chaos' }
        ]
      : []),
  ]

  return (
    <Boundary>
      <Nav token={token} email={email} role={role} onLogout={onLogout}/>
      <div style={{padding:16, paddingBottom:'calc(var(--footer-h) + 24px)'}}>
        <h2>Admin panel</h2>
        <p>Signed in: {email} · Role: {role}</p>

        <div style={{display:'flex',gap:8,margin:'12px 0'}}>
          {tabsConfig.map(b=>{
            const isActive = tab===b.key
            const highlight = b.key==='APPROVALS' && b.needsAttention
            const isNineCircles = b.key.startsWith('NINE_CIRCLES')
            let background = isActive ? '#111827' : '#fff'
            let color = isActive ? '#fff' : '#111827'
            let borderColor = '#d1d5db'
            if(highlight){
              background = '#b91c1c'
              color = '#fff'
              borderColor = '#b91c1c'
            }
            if(isNineCircles){
              background = isActive
                ? 'linear-gradient(140deg,#7f1d1d 0%,#b91c1c 60%,#f97316 100%)'
                : 'linear-gradient(140deg,#431407 0%,#7f1d1d 70%,#991b1b 100%)'
              color = '#fef3c7'
              borderColor = '#7f1d1d'
            }
            return (
              <button key={b.key} onClick={()=>setTab(b.key)}
                style={{
                  padding:'8px 12px',
                  border:`1px solid ${borderColor}`,
                  borderRadius:8,
                  background,
                  color,
                  cursor:'pointer',
                  fontWeight: highlight ? 700 : 500
                }}>
                {b.label}{b.key==='APPROVALS' && totalPending>0 ? ` (${totalPending})` : ''}
              </button>
            )
          })}
        </div>

        {tab==='APPROVALS' && (
          <>
            <AdminApprovalCenter
              token={token}
              onCountsChange={setPendingCounts}
            />
          </>
        )}

        {tab==='USERS' && (
          <>
            <Collapsible title="Users">
              <AdminUsers token={token} includeRegistration={false} actorRole={role}/>
            </Collapsible>
            <Collapsible title="Labs">
              <AdminLabs token={token}/>
            </Collapsible>
            <Collapsible title="Clients">
              <AdminClients token={token}/>
            </Collapsible>
          </>
        )}

        {tab==='CONFIG' && (
          <>
            <Collapsible title="Resources">
              <AdminResources token={token}/>
            </Collapsible>
            <Collapsible title="Probes per resource"><AdminProbes token={token}/></Collapsible>
            <Collapsible title="Experiments"><AdminExperiments token={token}/></Collapsible>
            <Collapsible title="Pricing"><AdminPricing token={token}/></Collapsible>
            <Collapsible title="Policy: anti-stockpiling caps & cancellation cutoffs"><AdminPolicies token={token}/></Collapsible>
            <Collapsible title="Maintenance windows"><AdminMaintenance token={token}/></Collapsible>
            <Collapsible title="Training windows"><AdminTraining token={token}/></Collapsible>
            <Collapsible title="Logo"><AdminLogo token={token}/></Collapsible>
            <Collapsible title="Slot colors"><AdminSlotColors token={token}/></Collapsible>
          </>
        )}

        {tab==='APPROVALS_MAILS' && (
          <>
            <Collapsible title="Broadcast mails">
              <AdminBroadcast token={token}/>
            </Collapsible>
            <Collapsible title="Broadcast mail log">
              <AdminMailLog token={token}/>
            </Collapsible>
            <Collapsible title="Bulletin">
              <AdminBulletin token={token}/>
            </Collapsible>
          </>
        )}

        {tab==='ALL_BOOKINGS' && (
          <>
            <AdminAllBookings token={token}/>
          </>
        )}

        {tab==='REPORTS' && (
          <>
            <AdminReports token={token}/>
          </>
        )}

        {tab.startsWith('NINE_CIRCLES') && (
          <>
            <AdminNineCirclesOfHell
              token={token}
              user={{ email, role }}
              defaultSection={CIRCLE_SECTION_BY_TAB[tab]}
            />
          </>
        )}
      </div>
      <Footer/>
    </Boundary>
  )
}

function Collapsible({ title, children, defaultOpen=false }){
  const [open,setOpen]=React.useState(defaultOpen)
  return (
    <div className="card" style={{marginTop:12}}>
      <div className="section" style={{cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}} onClick={()=>setOpen(o=>!o)}>
        <div style={{fontWeight:700}}>{title}</div>
        <div style={{color:'var(--muted)'}}>{open?'▲':'▼'}</div>
      </div>
      {open && (
        <div className="section" style={{borderTop:'1px solid var(--border)'}}>
          {children}
        </div>
      )}
    </div>
  )
}
