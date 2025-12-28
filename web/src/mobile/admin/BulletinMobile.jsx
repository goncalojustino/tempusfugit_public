import React, { useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function BulletinMobile({ token }){
  const [text,setText]=useState('')
  const [msg,setMsg]=useState('')
  async function save(){ const r=await fetch(`${API}/admin/bulletin/save`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({text}) }); const j=await r.json(); setMsg(r.ok?'Published':(j.error||'ERROR')) }
  async function remove(){ const r=await fetch(`${API}/admin/bulletin/remove`,{ method:'POST', headers:{'Authorization':'Bearer '+token} }); const j=await r.json(); setMsg(r.ok?'Removed':(j.error||'ERROR')) }
  return (
    <div className="card" style={{padding:12,display:'grid',gap:8}}>
      <div style={{fontWeight:600}}>Bulletin</div>
      <textarea className="input" rows={6} placeholder="Text" value={text} onChange={e=>setText(e.target.value)} />
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <button className="btn" onClick={save} disabled={!text.trim()}>Publish</button>
        <button className="btn secondary" onClick={remove}>Remove</button>
        <span className="muted">{msg}</span>
      </div>
    </div>
  )
}

