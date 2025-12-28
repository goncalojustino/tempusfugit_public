import React, { useState } from 'react'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
const API = import.meta.env.VITE_API_URL || '/api'

export default function Account({ token, email, role, onLogout }){
  const [current,setCurrent]=useState('')
  const [next,setNext]=useState('')
  const [msg,setMsg]=useState('')

  async function submit(e){
    e.preventDefault(); setMsg('Saving…')
    try{
      const r=await fetch(`${API}/me/passcode`,{
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({ current, next })
      })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
      setMsg('Passcode updated.')
      setCurrent(''); setNext('')
    }catch{ setMsg('ERROR') }
  }
  return (
    <div>
      <Nav token={token} email={email} role={role} onLogout={onLogout}/>
      <div className="container">
        <h2>Account</h2>
        <div style={{maxWidth:520}}>
          <form onSubmit={submit} style={{display:'grid',gap:12}}>
            <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:8,alignItems:'center'}}>
              <div style={{textAlign:'right',fontWeight:600}}>Current passcode</div>
              <input className="input" type="password" value={current} onChange={e=>setCurrent(e.target.value)} />
              <div style={{textAlign:'right',fontWeight:600}}>New passcode</div>
              <input className="input" type="password" value={next} onChange={e=>setNext(e.target.value)} />
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'flex-end'}}>
              <span className="muted" style={{flex:1}}>{msg}</span>
              <button className="btn" disabled={!current||!next}>Change passcode</button>
            </div>
          </form>
        </div>
      </div>
      <Footer/>
    </div>
  )
}
