import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
const API = import.meta.env.VITE_API_URL || '/api'

export default function MobileLogin({token,setToken,role,setRole,email,setEmail}){
  const [passcode,setPasscode]=useState('')
  const [msg,setMsg]=useState('')
  const nav=useNavigate()
  useEffect(()=>{ if(token) nav('/mobile/home',{replace:true}) },[token,nav])
  useEffect(()=>{ localStorage.setItem('tf_view','mobile') },[])
  async function login(e){
    e.preventDefault(); setMsg('Signing in…')
    try{
      let meta = {}
      try{
        const now = new Date()
        const tzInfo = typeof Intl !== 'undefined' && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions?.() : null
        meta = {
          tz_name: tzInfo && typeof tzInfo.timeZone === 'string' ? tzInfo.timeZone : null,
          tz_offset_minutes: Number.isFinite(now.getTimezoneOffset()) ? (0 - now.getTimezoneOffset()) : null,
          client_time_iso: now.toISOString(),
          language: typeof navigator !== 'undefined' ? navigator.language || null : null,
        }
      }catch(_){
        const now = new Date()
        meta = { client_time_iso: now.toISOString() }
      }
      const r = await fetch(`${API}/auth/login`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, passcode, meta }) })
      const j = await r.json(); if(!r.ok) throw new Error(j.error||'LOGIN FAILED')
      setToken(j.token); setRole(j.role); setEmail(j.email); nav('/mobile/home',{replace:true})
    }catch(e){ setMsg(String(e.message||e)) }
  }
  return (
    <div style={{minHeight:'100vh',display:'grid',gridTemplateRows:'auto 1fr',background:'var(--bg)',paddingBottom:'calc(var(--footer-h) + 24px)'}}>
      <div>
        {/* Reuse mobile nav for consistent layout */}
        {/* eslint-disable-next-line */}
      </div>
      <div style={{display:'grid',placeItems:'center',padding:16}}>
        <div className="card" style={{width:'100%',maxWidth:480, padding:16, margin:'0 auto', textAlign:'center'}}>
          <div style={{fontWeight:700, marginBottom:8}}>Welcome to TempusFugit</div>
          <div className="muted" style={{marginBottom:12}}><CHANGE:logo_or_motto_here></div>
          <form onSubmit={login} style={{display:'grid',gap:12}}>
            <div style={{display:'grid',gap:8}}>
              <div style={{fontWeight:600}}>E-mail</div>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%'}}/>
              <div style={{fontWeight:600}}>Passcode</div>
              <input className="input" type="password" value={passcode} onChange={e=>setPasscode(e.target.value)} style={{width:'100%'}}/>
            </div>
            <button className="btn" disabled={!email||!passcode}>Sign in</button>
            <div className="muted" style={{minHeight:18}}>{msg}</div>
            <button type="button" className="btn secondary" onClick={()=>{ localStorage.setItem('tf_view','desktop'); nav('/login',{replace:true}) }}>Switch to desktop (Admin only on desktop)</button>
          </form>
        </div>
      </div>
    </div>
  )
}
