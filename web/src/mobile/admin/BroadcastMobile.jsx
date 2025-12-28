import React, { useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function BroadcastMobile({ token }){
  const [subject,setSubject]=useState('')
  const [text,setText]=useState('')
  const [msg,setMsg]=useState('')
  async function send(){ setMsg('Sending…'); const r=await fetch(`${API}/admin/notify/all`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({subject,text}) }); const j=await r.json(); setMsg(r.ok?`Sent to ${j.recipients}`:(j.error||'ERROR')) }
  return (
    <div className="card" style={{padding:12,display:'grid',gap:8}}>
      <div style={{fontWeight:600}}>Broadcast mail</div>
      <input className="input" placeholder="Subject" value={subject} onChange={e=>setSubject(e.target.value)} />
      <textarea className="input" rows={6} placeholder="Message" value={text} onChange={e=>setText(e.target.value)} />
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <button className="btn" onClick={send} disabled={!subject||!text}>Send</button>
        <span className="muted">{msg}</span>
      </div>
    </div>
  )
}

