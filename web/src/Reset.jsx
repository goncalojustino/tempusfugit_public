import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
const API = import.meta.env.VITE_API_URL || '/api'

export default function Reset(){
  const [token,setToken]=useState('')
  const [email,setEmail]=useState('')
  const [p1,setP1]=useState('')
  const [p2,setP2]=useState('')
  const [msg,setMsg]=useState('')
  const [done,setDone]=useState(false)
  const [step,setStep]=useState('email') // 'email' | 'pass'
  const [contact,setContact]=useState(false)
  useEffect(()=>{
    const t=new URLSearchParams(location.search).get('token')||''
    if(t){
      setToken(t)
      setStep('pass')
    }
  },[])

  function validate(pass){
    const p = String(pass||'')
    const rules = {
      length: p.length >= 12 && p.length <= 256,
      lower: /[a-z]/.test(p),
      upper: /[A-Z]/.test(p),
      digit: /\d/.test(p),
      symbol: /[^A-Za-z0-9]/.test(p),
      noEmail: email ? !p.toLowerCase().includes(String(email).toLowerCase()) : true,
    }
    const ok = Object.values(rules).every(Boolean)
    return { ok, rules }
  }

  async function checkEmail(e){
    e.preventDefault(); setMsg('Checking…'); setContact(false)
    try{
      const r=await fetch(`${API}/public/check_email?email=${encodeURIComponent(email)}`)
      const j=await r.json(); const ok = !!j?.exists
      if(!ok){ setMsg('No registered account for this email.'); setContact(true); return }
    }catch{ setMsg('ERROR'); return }
    try{
      const body = { email }
      const resp = await fetch(`${API}/public/forgot_password`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if(!resp.ok){ const t=await resp.json().catch(()=>({})); setMsg(t.error||'ERROR'); return }
      setMsg('Check your email for the reset link. Follow the link to set a new passcode.')
    }catch{ setMsg('ERROR') }
  }

  async function submit(e){
    e.preventDefault();
    if(p1!==p2){ setMsg('Passcodes do not match'); return }
    const check = validate(p1)
    if(!check.ok){ setMsg('Passcode does not meet the requirements'); return }
    setMsg('Saving…')
    try{
      const r=await fetch(`${API}/public/reset_password`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token, email, passcode:p1 }) })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
      setMsg('Passcode set. You can login now.')
      setP1(''); setP2(''); setDone(true)
    }catch{ setMsg('ERROR') }
  }

  return (
    <div className="container" style={{maxWidth:560}}>
      <h2>Reset your passcode</h2>
      <div className="card" style={{padding:16}}>
        {step==='email' && (
          <form onSubmit={checkEmail} style={{display:'grid',gap:12}}>
            <label style={{display:'grid',gap:6}}>
              <span style={{fontSize:12,color:'var(--muted)'}}>Email</span>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
            </label>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button className="btn" disabled={!email}>Continue</button>
              {done
                ? <span className="muted">Passcode set. You can login now. <Link to="/login">Login</Link></span>
                : <span className="muted">{msg}</span>
              }
            </div>
          </form>
        )}
        {step==='pass' && (
          <form onSubmit={submit} style={{display:'grid',gap:12}}>
            <input className="input" type="hidden" value={token} readOnly/>
            <label style={{display:'grid',gap:6}}>
              <span style={{fontSize:12,color:'var(--muted)'}}>Email</span>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
            </label>
            <label style={{display:'grid',gap:6}}>
              <span style={{fontSize:12,color:'var(--muted)'}}>Passcode</span>
              <input className="input" type="password" value={p1} onChange={e=>setP1(e.target.value)} />
            </label>
            <label style={{display:'grid',gap:6}}>
              <span style={{fontSize:12,color:'var(--muted)'}}>Repeat</span>
              <input className="input" type="password" value={p2} onChange={e=>setP2(e.target.value)} />
            </label>
            <PasswordRules email={email} pass={p1} />
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button className="btn" disabled={!token||!email||!p1||!p2||!validate(p1).ok||p1!==p2}>Save</button>
              {done
                ? <span className="muted">Passcode set. You can login now. <Link to="/login">Login</Link></span>
                : <span className="muted">{msg}</span>
              }
            </div>
          </form>
        )}
      </div>
      {contact && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'grid',placeItems:'center'}}>
          <div style={{width:520,background:'#fff',borderRadius:12,padding:16,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}}>
            <h3 style={{marginTop:0}}>Contact staff</h3>
            <ContactForm defaultMessage={`Hello, I tried to reset the passcode for ${email} but no account was found.`} onClose={()=>setContact(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

function Rule({ ok, children }){
  const color = ok ? 'var(--ok, #0a0)' : 'var(--muted)'
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color}}>
      <span style={{fontWeight:'bold'}}>{ok ? '✓' : '•'}</span>
      <span>{children}</span>
    </div>
  )
}

function PasswordRules({ email, pass }){
  const p = String(pass||'')
  const checks = {
    length: p.length >= 12 && p.length <= 256,
    lower: /[a-z]/.test(p),
    upper: /[A-Z]/.test(p),
    digit: /\d/.test(p),
    symbol: /[^A-Za-z0-9]/.test(p),
    noEmail: email ? !p.toLowerCase().includes(String(email).toLowerCase()) : true,
  }
  return (
    <div style={{background:'var(--bg2,#fafafa)',border:'1px solid var(--border,#eee)',borderRadius:8,padding:12}}>
      <div style={{fontSize:12,marginBottom:6,color:'var(--muted)'}}>Passcode must include:</div>
      <Rule ok={checks.length}>At least 12 characters</Rule>
      <Rule ok={checks.lower}>A lowercase letter</Rule>
      <Rule ok={checks.upper}>An uppercase letter</Rule>
      <Rule ok={checks.digit}>A number</Rule>
      <Rule ok={checks.symbol}>A symbol</Rule>
      <Rule ok={checks.noEmail}>Must not contain your email</Rule>
    </div>
  )
}

function ContactForm({ onClose, defaultMessage='' }){
  const [name,setName]=useState('')
  const [contact,setContact]=useState('')
  const [message,setMessage]=useState(defaultMessage)
  const [msg,setMsg]=useState('')
  async function send(e){
    e.preventDefault(); setMsg('Sending…')
    try{
      const body = { name, contact, message }
      const r=await fetch(`${API}/public/contact`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if(!r.ok){ const t=await r.text(); setMsg(t||'ERROR'); return }
      setMsg('Sent.'); setTimeout(()=> onClose(), 400)
    }catch{ setMsg('ERROR') }
  }
  return (
    <form onSubmit={send} style={{display:'grid',gap:8,textAlign:'left'}}>
      <label>Name<input className="input" value={name} onChange={e=>setName(e.target.value)} /></label>
      <label>Contact (email/phone)<input className="input" value={contact} onChange={e=>setContact(e.target.value)} /></label>
      <label>Message<textarea className="input" value={message} onChange={e=>setMessage(e.target.value)} rows={5} /></label>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <span style={{flex:1,color:'var(--muted)'}}>{msg}</span>
        <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" type="submit" disabled={!message.trim()}>Send</button>
      </div>
    </form>
  )
}
