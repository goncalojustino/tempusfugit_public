import React, { useEffect, useState } from 'react'
import MobileNav from './MobileNav.jsx'
const API = import.meta.env.VITE_API_URL || '/api'

const fmt = d=>{ const x=new Date(d); const p=n=>String(n).padStart(2,'0'); return `${p(x.getDate())}/${p(x.getMonth()+1)}/${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}` }

export default function MyMobile({ token, email, role, onLogout }){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  useEffect(()=>{ localStorage.setItem('tf_view','mobile') },[])
  async function load(){
    setMsg('Loading…')
    try{
      const r=await fetch(`${API}/me/upcoming`,{ headers:{'X-User-Email':email,'Authorization':'Bearer '+token} })
      const j=await r.json(); if(!r.ok) throw new Error(j.error||'FAILED'); setRows(Array.isArray(j)?j:[]); setMsg('')
    }catch(e){ setMsg(String(e.message||e)) }
  }
  useEffect(()=>{ load() },[token,email])
  async function cancel(id){
    try{
      const r=await fetch(`${API}/reservations/cancel`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({id,email}) })
      const j=await r.json(); if(!r.ok) throw new Error(j.error||'FAILED'); load()
    }catch(e){ alert(String(e.message||e)) }
  }
  return (
    <div>
      <MobileNav title="My bookings" role={role} onSwitchDesktop={()=> location.assign('/my')}/>
      <div className="container">
        <div className="muted" style={{marginBottom:8}}>{msg}</div>
        <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
          {[...rows]
            .sort((a,b)=> new Date(b.start_ts||b.start) - new Date(a.start_ts||a.start))
            .map(r=> {
              const by = String(r.canceled_by||'').toLowerCase()
              const owner = String(r.user_email||email||'').toLowerCase()
              let status = r.status
              if(r.status==='PENDING') status = 'Pending approval'
              else if(r.status==='CANCEL_PENDING') status = 'Cancellation pending review'
              else if(r.status==='CANCELED') status = (by && by !== owner) ? 'Denied by staff' : 'Canceled'
              return (
                <li key={r.id} className="card" style={{padding:12, cursor: (r.status==='APPROVED' || r.status==='PENDING') && new Date(r.start_ts||r.start) > new Date() ? 'pointer' : 'default'}}
                    onClick={() => {
                      if ((r.status==='APPROVED' || r.status==='PENDING') && new Date(r.start_ts||r.start) > new Date()) {
                        if (confirm('Are you sure you want to request cancellation for this booking?')) {
                          cancel(r.id)
                        }
                      }
                    }}>
                  <div>
                    <div><strong>{r.resource}</strong> · {fmt(r.start_ts||r.start)} → {fmt(r.end_ts||r.end)}</div>
                    <div className="muted" style={{fontSize:12}}>{r.experiment} · {r.probe} · {status}</div>
                    {(r.status==='APPROVED' || r.status==='PENDING') && new Date(r.start_ts||r.start) > new Date() ? (
                      <div className="muted" style={{fontSize:12, color:'var(--c-russet)', fontWeight:600, marginTop:4}}>Tap to cancel</div>
                    ) : null}
                  </div>
                </li>
              )
            })}
        </ul>
      </div>
    </div>
  )
}
