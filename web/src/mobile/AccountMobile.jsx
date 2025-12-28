import React, { useState } from 'react'
import MobileNav from './MobileNav.jsx'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AccountMobile({ token, email, role, onLogout }){
  const [current,setCurrent]=useState('')
  const [next,setNext]=useState('')
  const [msg,setMsg]=useState('')
  async function submit(e){
    e.preventDefault(); setMsg('Saving…')
    try{
      const r=await fetch(`${API}/me/passcode`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({current, next}) })
      const j=await r.json(); if(!r.ok) throw new Error(j.error||'FAILED'); setMsg('Passcode updated.'); setCurrent(''); setNext('')
    }catch(e){ setMsg(String(e.message||e)) }
  }
  return (
    <div>
      <MobileNav title="Account" role={role} onSwitchDesktop={()=> location.assign('/account')}/>
      <div className="container">
        <form onSubmit={submit} className="card" style={{padding:12,display:'grid',gap:12,maxWidth:520}}>
          <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:8,alignItems:'center'}}>
            <div style={{textAlign:'right',fontWeight:600}}>Current passcode</div>
            <input className="input" type="password" value={current} onChange={e=>setCurrent(e.target.value)} />
            <div style={{textAlign:'right',fontWeight:600}}>New passcode</div>
            <input className="input" type="password" value={next} onChange={e=>setNext(e.target.value)} />
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'flex-end'}}>
            <span className="muted" style={{flex:1}}>{msg}</span>
            <button className="btn" disabled={!current||!next}>Change</button>
          </div>
        </form>
      </div>
    </div>
  )
}
