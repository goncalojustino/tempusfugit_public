import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function ExperimentsMobile({ token }){
  const [experiments,setExperiments]=useState([])
  const [overrides,setOverrides]=useState([])
  const [form,setForm]=useState({code:'',name:'',requires_approval:false})
  useEffect(()=>{ load() },[])
  async function load(){ try{ const r=await fetch(`${API}/admin/experiments`,{ headers:{'Authorization':'Bearer '+token} }); const j=await r.json(); setExperiments(j.experiments||[]); setOverrides(j.resource_overrides||[]) }catch{} }
  async function upsert(){ const r=await fetch(`${API}/admin/experiments/upsert`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify(form) }); const j=await r.json(); if(!r.ok) return alert(j.error||'ERROR'); setForm({code:'',name:'',requires_approval:false}); load() }
  async function del(code){ if(!confirm('Delete experiment?')) return; const r=await fetch(`${API}/admin/experiments/delete`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({code}) }); await r.json(); load() }
  return (
    <div>
      <div className="card" style={{padding:12,display:'grid',gap:8,marginBottom:12}}>
        <div style={{fontWeight:600}}>Experiments</div>
        <input className="input" placeholder="code" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} />
        <input className="input" placeholder="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
        <label><input type="checkbox" checked={!!form.requires_approval} onChange={e=>setForm({...form,requires_approval:e.target.checked})}/> Requires approval</label>
        <button className="btn" onClick={upsert} disabled={!form.code||!form.name}>Save</button>
      </div>
      <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
        {experiments.map(e=> (
          <li key={e.code} className="card" style={{padding:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><strong>{e.code}</strong> · {e.name} · {e.requires_approval?'needs approval':'auto'}</div>
            <button className="btn secondary" onClick={()=>del(e.code)}>Delete</button>
          </li>
        ))}
      </ul>
      <div className="card" style={{padding:12,marginTop:12}}>
        <div style={{fontWeight:600,marginBottom:6}}>Resource overrides</div>
        <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
          {overrides.map((o,i)=> (
            <li key={i} className="card" style={{padding:12}}>
              <div><strong>{o.resource}</strong> · {o.code} · {o.requires_approval?'needs approval':'auto'}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

