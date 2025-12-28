import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function ApprovalsMobile({ token }){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  useEffect(()=>{ load() },[])
  async function load(){ try{ const r=await fetch(`${API}/admin/reservations/pending`,{ headers:{'Authorization':'Bearer '+token} }); const j=await r.json(); setRows(Array.isArray(j)?j:[]) }catch{ setRows([]) } }
  async function approve(id){ const r=await fetch(`${API}/admin/reservations/approve`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({id}) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); load() }
  async function deny(id){ if(!confirm('Deny request?')) return; const r=await fetch(`${API}/admin/reservations/deny`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({id}) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); load() }
  return (
    <div>
      <div className="muted">{msg}</div>
      <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
        {rows.map(r=> (
          <li key={r.id} className="card" style={{padding:12,display:'grid',gap:6}}>
            <div><strong>{r.resource}</strong> · {new Date(r.start_ts).toLocaleString()} → {new Date(r.end_ts).toLocaleString()}</div>
            <div className="muted" style={{fontSize:12}}>{r.user_email} · {r.experiment} · {r.probe} · €{r.price_eur??''} · {r.rate_code||''}</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={()=>approve(r.id)}>Approve</button>
              <button className="btn secondary" onClick={()=>deny(r.id)}>Deny</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

