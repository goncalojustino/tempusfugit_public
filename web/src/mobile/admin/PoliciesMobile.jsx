import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function PoliciesMobile({ token }){
  const [caps,setCaps]=useState([])
  const [rules,setRules]=useState([])
  const [fcap,setFcap]=useState({resource:'NMR300',block_label:'30m',max_future_minutes:0})
  const [frule,setFrule]=useState({resource:'NMR300',block_label:'30m',cutoff_minutes:0})
  useEffect(()=>{ load() },[])
  async function load(){
    try{ const rc=await fetch(`${API}/admin/caps`,{ headers:{'Authorization':'Bearer '+token} }); const jc=await rc.json(); setCaps(Array.isArray(jc)?jc:[]) }catch{}
    try{ const rr=await fetch(`${API}/admin/cancel_rules`,{ headers:{'Authorization':'Bearer '+token} }); const jr=await rr.json(); setRules(Array.isArray(jr)?jr:[]) }catch{}
  }
  async function saveCap(){ await fetch(`${API}/admin/caps/upsert`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ ...fcap, max_future_minutes:Number(fcap.max_future_minutes)||0 }) }); load() }
  async function delCap(resource, block_label){ await fetch(`${API}/admin/caps/delete`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ resource, block_label }) }); load() }
  async function saveRule(){ await fetch(`${API}/admin/cancel_rules/upsert`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ ...frule, cutoff_minutes:Number(frule.cutoff_minutes)||0 }) }); load() }
  async function delRule(resource, block_label){ await fetch(`${API}/admin/cancel_rules/delete`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ resource, block_label }) }); load() }
  return (
    <div style={{display:'grid',gap:12}}>
      <div className="card" style={{padding:12,display:'grid',gap:8}}>
        <div style={{fontWeight:600}}>Caps (anti-stockpiling)</div>
        <select className="select" value={fcap.resource} onChange={e=>setFcap({...fcap,resource:e.target.value})}><option>NMR300</option><option>NMR400</option><option>NMR500</option></select>
        <select className="select" value={fcap.block_label} onChange={e=>setFcap({...fcap,block_label:e.target.value})}><option>30m</option><option>3h</option><option>24h</option></select>
        <input className="input" type="number" placeholder="max minutes" value={fcap.max_future_minutes} onChange={e=>setFcap({...fcap,max_future_minutes:e.target.value})}/>
        <button className="btn" onClick={saveCap}>Save</button>
        <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:6}}>
          {caps.map((c,i)=> <li key={i} className="card" style={{padding:8,display:'flex',justifyContent:'space-between'}}><span>{c.resource} · {c.block_label} · {c.max_future_minutes} min</span><button className="btn secondary" onClick={()=>delCap(c.resource,c.block_label)}>Delete</button></li>)}
        </ul>
      </div>
      <div className="card" style={{padding:12,display:'grid',gap:8}}>
        <div style={{fontWeight:600}}>Cancel rules</div>
        <select className="select" value={frule.resource} onChange={e=>setFrule({...frule,resource:e.target.value})}><option>NMR300</option><option>NMR400</option><option>NMR500</option></select>
        <select className="select" value={frule.block_label} onChange={e=>setFrule({...frule,block_label:e.target.value})}><option>30m</option><option>3h</option><option>24h</option></select>
        <input className="input" type="number" placeholder="cutoff minutes" value={frule.cutoff_minutes} onChange={e=>setFrule({...frule,cutoff_minutes:e.target.value})}/>
        <button className="btn" onClick={saveRule}>Save</button>
        <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:6}}>
          {rules.map((r,i)=> <li key={i} className="card" style={{padding:8,display:'flex',justifyContent:'space-between'}}><span>{r.resource} · {r.block_label} · {r.cutoff_minutes} min</span><button className="btn secondary" onClick={()=>delRule(r.resource,r.block_label)}>Delete</button></li>)}
        </ul>
      </div>
    </div>
  )
}

