import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function ResourcesMobile({ token }){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  useEffect(()=>{ load() },[])
  async function load(){ try{ const r=await fetch(`${API}/admin/resources`,{ headers:{'Authorization':'Bearer '+token} }); const j=await r.json(); setRows(Array.isArray(j)?j:[]) }catch{ setRows([]) } }
  async function save(r){ setMsg('Saving…'); const res=await fetch(`${API}/admin/resources/save`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ name:r.name, visible:!!r.visible, advance_days:Number(r.advance_days)||0, status:r.status, limitation_note:r.limitation_note||'', color_hex:(r.color_hex||'').trim() }) }); const j=await res.json(); if(!res.ok) return setMsg(j.error||'ERROR'); setMsg('Saved') }
  return (
    <div>
      <div className="muted">{msg}</div>
      <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
        {rows.map((r,i)=> (
          <li key={r.name} className="card" style={{padding:12}}>
            <div style={{fontWeight:600}}>{r.name}</div>
            <div style={{display:'grid',gap:6,marginTop:6}}>
              <label><input type="checkbox" checked={!!r.visible} onChange={e=>{ const v=e.target.checked; setRows(x=> x.map((y,idx)=> idx===i? {...y,visible:v}:y)) }}/>{' '}Visible</label>
              <label>Advance days<input className="input" type="number" value={r.advance_days??0} onChange={e=>{ const v=e.target.value; setRows(x=> x.map((y,idx)=> idx===i? {...y,advance_days:v}:y)) }} /></label>
              <label>Status<select className="select" value={r.status||'OK'} onChange={e=>{ const v=e.target.value; setRows(x=> x.map((y,idx)=> idx===i? {...y,status:v}:y)) }}><option>OK</option><option>LIMITED</option><option>DOWN</option></select></label>
              <label>Note<input className="input" value={r.limitation_note||''} onChange={e=>{ const v=e.target.value; setRows(x=> x.map((y,idx)=> idx===i? {...y,limitation_note:v}:y)) }} /></label>
              <label>Color<input className="input" placeholder="#RRGGBB" value={r.color_hex||''} onChange={e=>{ const v=e.target.value; setRows(x=> x.map((y,idx)=> idx===i? {...y,color_hex:v}:y)) }} /></label>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button className="btn" onClick={()=>save(rows[i])}>Save</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
