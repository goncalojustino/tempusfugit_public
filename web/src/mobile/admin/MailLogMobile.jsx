import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function MailLogMobile({ token }){
  const [rows,setRows]=useState([])
  useEffect(()=>{ load() },[])
  async function load(){ try{ const r=await fetch(`${API}/admin/notify/log`,{ headers:{'Authorization':'Bearer '+token} }); const j=await r.json(); setRows(Array.isArray(j)?j:[]) }catch{ setRows([]) } }
  return (
    <div className="card" style={{padding:12}}>
      <div style={{fontWeight:600, marginBottom:8}}>Broadcast mail log</div>
      <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
        {rows.map(r=> (
          <li key={r.id} className="card" style={{padding:8}}>
            <div><strong>{r.subject}</strong></div>
            <div className="muted" style={{fontSize:12}}>{new Date(r.ts).toLocaleString()} · by {r.actor} · recipients: {r.recipients}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

