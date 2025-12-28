import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function LabsMobile({ token }){
  const [rows,setRows]=useState([])
  const [name,setName]=useState('')
  const [msg,setMsg]=useState('')
  useEffect(()=>{ load() },[])
  async function load(){ try{ const r=await fetch(`${API}/admin/labs`,{ headers:{'Authorization':'Bearer '+token} }); const j=await r.json(); setRows(Array.isArray(j)?j:[]) }catch{ setRows([]) } }
async function add(){ const r=await fetch(`${API}/admin/labs/save`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({name}) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); setName(''); window.location.reload() }
async function save(id, newName){ const r=await fetch(`${API}/admin/labs/save`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({id, name:newName}) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); window.location.reload() }
async function del(id){ if(!confirm('Delete lab?')) return; const r=await fetch(`${API}/admin/labs/delete`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({id}) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); window.location.reload() }
  return (
    <div>
      <div className="card" style={{padding:12,display:'grid',gap:8,marginBottom:12}}>
        <div style={{fontWeight:600}}>Add lab</div>
        <input className="input" placeholder="name" value={name} onChange={e=>setName(e.target.value)} />
        <button className="btn" onClick={add} disabled={!name.trim()}>Add</button>
        <div className="muted">{msg}</div>
      </div>
      <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
        {rows.map(l=> (
          <li key={l.id} className="card" style={{padding:12}}>
            <div style={{display:'flex',gap:8}}>
              <input className="input" defaultValue={l.name} onBlur={e=>{ const v=e.target.value.trim(); if(v && v!==l.name) save(l.id,v) }} />
              <button className="btn secondary" onClick={()=>del(l.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
