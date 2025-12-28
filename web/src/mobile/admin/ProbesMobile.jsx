import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function ProbesMobile({ token }){
  const [rows,setRows]=useState([])
  const [form,setForm]=useState({resource:'NMR300',probe:'',active:true})
  const [msg,setMsg]=useState('')
  useEffect(()=>{ load() },[])
  async function load(){ try{ const r=await fetch(`${API}/admin/probes`,{ headers:{'Authorization':'Bearer '+token} }); const j=await r.json(); setRows(Array.isArray(j)?j:[]) }catch{ setRows([]) } }
  async function upsert(){ const r=await fetch(`${API}/admin/probes/upsert`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({resource:form.resource,probe:form.probe,active:!!form.active}) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); setForm({...form,probe:''}); load() }
  return (
    <div>
      <div className="card" style={{padding:12,display:'grid',gap:8,marginBottom:12}}>
        <div style={{fontWeight:600}}>Add/Update probe</div>
        <select className="select" value={form.resource} onChange={e=>setForm({...form,resource:e.target.value})}><option>NMR300</option><option>NMR400</option><option>NMR500</option></select>
        <input className="input" placeholder="probe" value={form.probe} onChange={e=>setForm({...form,probe:e.target.value})} />
        <label><input type="checkbox" checked={!!form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label>
        <button className="btn" onClick={upsert} disabled={!form.probe.trim()}>Save</button>
        <div className="muted">{msg}</div>
      </div>
      <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
        {rows.map((r,idx)=> (
          <li key={idx} className="card" style={{padding:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><strong>{r.resource}</strong> · {r.probe}</div>
            <div className="muted">{r.active? 'active':'inactive'}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

