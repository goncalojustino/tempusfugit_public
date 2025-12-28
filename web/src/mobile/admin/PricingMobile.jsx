import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function PricingMobile({ token }){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  const [form,setForm]=useState({resource:'NMR300',experiment:'REGULAR',probe:'',rate_code:'STD',rate_per_hour_eur:'1.00',effective_from:''})
  useEffect(()=>{ load() },[])
  async function load(){ try{ const r=await fetch(`${API}/admin/pricing`,{ headers:{'Authorization':'Bearer '+token} }); const j=await r.json(); setRows(Array.isArray(j)?j:[]) }catch{ setRows([]) } }
  async function upsert(){ setMsg('Saving…'); const r=await fetch(`${API}/admin/pricing/upsert`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ ...form, rate_per_hour_eur:Number(form.rate_per_hour_eur) }) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); setMsg('Saved'); load() }
  async function del(id){ if(!confirm('Delete price row?')) return; const r=await fetch(`${API}/admin/pricing/delete`,{ method:'DELETE', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({id}) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); load() }
  async function reset(){ const r=await fetch(`${API}/admin/pricing/reset_defaults`,{ method:'POST', headers:{'Authorization':'Bearer '+token} }); const j=await r.json(); setMsg(r.ok?`Defaults updated (${j.updated})`:'Failed') }
  return (
    <div>
      <div className="card" style={{padding:12,display:'grid',gap:8,marginBottom:12}}>
        <div style={{fontWeight:600}}>Add/Update pricing</div>
        <select className="select" value={form.resource} onChange={e=>setForm({...form,resource:e.target.value})}><option>NMR300</option><option>NMR400</option><option>NMR500</option></select>
        <select className="select" value={form.experiment} onChange={e=>setForm({...form,experiment:e.target.value})}><option>REGULAR</option><option>VT</option></select>
        <input className="input" placeholder="probe" value={form.probe} onChange={e=>setForm({...form,probe:e.target.value})} />
        <input className="input" placeholder="rate code" value={form.rate_code} onChange={e=>setForm({...form,rate_code:e.target.value})} />
        <input className="input" type="number" step="0.01" placeholder="€/h" value={form.rate_per_hour_eur} onChange={e=>setForm({...form,rate_per_hour_eur:e.target.value})} />
        <input className="input" type="date" value={form.effective_from} onChange={e=>setForm({...form,effective_from:e.target.value})} />
        <div style={{display:'flex',gap:8}}>
          <button className="btn" onClick={upsert}>Save</button>
          <button className="btn secondary" onClick={reset}>Reset defaults</button>
          <span className="muted">{msg}</span>
        </div>
      </div>
      <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
        {rows.map(r=> (
          <li key={r.id} className="card" style={{padding:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><strong>{r.resource}</strong> · {r.experiment} · {r.probe} · {r.rate_code} · €{r.rate_per_hour_eur}/h · {String(r.effective_from).slice(0,10)}</div>
            <button className="btn secondary" onClick={()=>del(r.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

