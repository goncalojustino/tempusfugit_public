import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
const API = import.meta.env.VITE_API_URL || '/api'

export default function Login({token,setToken,role,setRole,email,setEmail}){
  const [passcode,setPasscode] = useState('')
  const [msg,setMsg] = useState('')
  const nav = useNavigate()
  const [bulletin,setBulletin]=useState({ text:'', by:'', at:'', resources:[] })
  const [staff,setStaff]=useState([])
  const [contact,setContact]=useState(false)
  const [toast,setToast]=useState('')
  const [contactTo,setContactTo]=useState(null) // email of a specific staff member

  useEffect(()=>{ if(token) nav('/', { replace:true }) },[token, nav])
  useEffect(()=>{
    fetch(`${API}/public/bulletin`).then(r=>r.json()).then(j=> {
      const text = String((j && j.text) || '').trim()
      setBulletin({ text, by: j.published_by||'', at: j.published_at||'', resources: Array.isArray(j?.resources)? j.resources : [] })
    }).catch(()=>{})
    fetch(`${API}/public/staff`).then(r=>r.json()).then(j=> Array.isArray(j)&&setStaff(j)).catch(()=>{})
  },[])

  async function login(e){
    e.preventDefault(); setMsg('Logging in…')
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
      const r = await fetch(`${API}/auth/login`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, passcode, meta })
      })
      const raw = await r.text()
      let data = null
      try { data = raw ? JSON.parse(raw) : null } catch(_) { /* non-JSON */ }
      if(!r.ok){
        const detail = data?.error || raw || `HTTP ${r.status} ${r.statusText}`
        throw new Error(detail)
      }
      if(!data || !data.token) throw new Error('BAD RESPONSE FROM SERVER')
      try{
        const r = String(data.role||'').toUpperCase()
        if(['STAFF','DANTE'].includes(r)){
          sessionStorage.setItem('tf_show_changes','yes')
          sessionStorage.setItem('tf_check_approvals','yes')
        }
      }catch(_){ }
      setToken(data.token); setRole(data.role); setEmail(data.email); nav('/',{replace:true})
    }catch(err){ setMsg(String(err.message||err).toUpperCase()) }
  }

  const linkBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid var(--accent)',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'none',
    width: '100%',
    textAlign: 'center',
  };

  return (
    <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',padding:'24px 0'}}>
      <main style={{width:820, maxWidth: 'calc(100vw - 32px)', background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:24,boxShadow:'0 1px 2px rgba(0,0,0,0.06)', textAlign:'center'}}>
        <section>
          <div style={{fontSize:24,fontWeight:700}}>Welcome to TempusFugit</div>
          <div className="muted"><CHANGE:logo_or_motto_here></div>
          <h1 style={{margin:'16px 0 24px', fontSize:20, fontStyle: 'italic'}}>
            tempusfugit login
          </h1>
        </section>

        <section style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', textAlign: 'left'}}>
          {/* Left Column */}
          <aside style={{display:'flex', flexDirection:'column', gap:'16px', alignItems: 'center'}}>
            <img 
              src="/api/public/logo_frontpage" 
              alt="Logo" 
              style={{ width: '75%', maxHeight: '120px', objectFit: 'contain' }} 
              onError={(e) => e.target.style.display='none'}
            />
            <div style={{padding:16, background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:8, textAlign:'left', width: '100%'}}>
              <div style={{fontWeight:600, marginBottom:6}}>Bulletin</div>
              {bulletin.text && (<div style={{color:'var(--text)'}}>{bulletin.text}</div>)}
              {(bulletin.text && bulletin.by && bulletin.at) ? (
                <div style={{marginTop:6, fontSize:12, color:'var(--muted)'}}>
                  Published by {bulletin.by} at {new Date(bulletin.at).toLocaleString()}
                </div>
              ) : null}
              <div style={{marginTop:10}}>
                <div style={{fontSize:14, color:'var(--muted)', marginBottom:4, textAlign:'center'}}>Resource status</div>
                <ul style={{margin:0, paddingLeft:18}}>
                  {(bulletin.resources||[]).map((r,i)=> (
                    <li key={i}>
                      <span style={{fontWeight:600}}>{r.name}</span>: {r.status}{r.note?` - ${r.note}`:''}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{marginTop:12, borderTop:'1px solid #e5e7eb'}} />
              <div style={{marginTop:10, fontSize:14, color:'var(--muted)', textAlign:'center'}}>Staff contacts</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:12, alignItems:'center'}}>
                <div style={{display:'flex', justifyContent:'center'}}>
                  <ul style={{margin:0, paddingLeft:18, textAlign:'left'}}>
                    {staff.map((s,i)=> (
                      <li key={i} style={{marginTop:4}}>
                        <button onClick={()=>{ setContactTo({ email:s.email, name:s.name||s.email }); setContact(true) }}
                                style={{background:'none',border:'none',padding:0,color:'#2563eb',cursor:'pointer',textDecoration:'underline', fontSize: '14px'}}>
                          {s.name||s.email}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{display:'grid', placeItems:'center'}}>
                  <button className="btn secondary" onClick={()=>{ setContactTo(null); setContact(true) }}>Contact staff</button>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Column */}
          <section style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            <form onSubmit={login} style={{display:'grid',gap:12}}>
              <label style={{display:'grid',gap:6}}>
                <span style={{fontSize:12,color:'var(--muted)'}}>Email</span>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                      className="input" placeholder="you@example.com" />
              </label>
              <label style={{display:'grid',gap:6}}>
                <span style={{fontSize:12,color:'var(--muted)'}}>Passcode</span>
                <input type="password" value={passcode} onChange={e=>setPasscode(e.target.value)}
                      className="input" placeholder="Enter passcode" />
              </label>
              <button type="submit" className="btn">
                Sign in
              </button>
            </form>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px'}}>
              <p style={{margin:0, minHeight: '1.2em', color: /FAIL|ERROR|BLOCKED/i.test(msg)?'var(--c-oxblood)':'var(--muted)',fontWeight:600}}>{msg}</p>
              <a href="/mobile/login" style={{
                display:'inline-flex',alignItems:'center',justifyContent:'center',
                padding:'12px 16px',borderRadius:'999px',
                background:'linear-gradient(90deg,#0ea5e9,#6366f1)',
                color:'#fff',fontWeight:700,fontSize:14,textDecoration:'none'
              }}>
                Use mobile version
              </a>
              <span className="muted" style={{fontSize:12}}>(beta version)</span>
              <a href="/register" style={linkBtnStyle}>Request access</a>
              <a href="/reset" style={linkBtnStyle}>Forgot passcode?</a>
            </div>
          </section>
        </section>

        <footer style={{marginTop:24,paddingTop:16,borderTop:'1px solid var(--border)',fontSize:12,color:'var(--muted)'}}>
          NMR Booking System © <a href="https://goncalojustino.github.io/" target="_blank" rel="noreferrer">GCJ</a>
        </footer>

        {contact && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'grid',placeItems:'center'}}>
            <div style={{width:520,background:'#fff',borderRadius:12,padding:16,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}}>
              <h3 style={{marginTop:0}}>Contact staff</h3>
              <ContactForm to={contactTo} onClose={()=>setContact(false)} onSent={()=>{ setToast('Message sent'); setTimeout(()=>setToast(''), 2500) }} />
            </div>
          </div>
        )}
        {toast && (
          <div style={{position:'fixed',right:16,bottom:16,background:'var(--accent)',color:'#fff',padding:'10px 14px',borderRadius:8,boxShadow:'0 6px 20px rgba(0,0,0,0.3)'}}>
            {toast}
          </div>
        )}
      </main>
    </div>
  )
}

function ContactForm({ to, onClose, onSent }){
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [phone,setPhone]=useState('')
  const [message,setMessage]=useState('')
  const [msg,setMsg]=useState('')
  async function send(e){
    e.preventDefault(); setMsg('Sending…')
    if(!name.trim()){ setMsg('Name is required'); return }
    if(!message.trim()){ setMsg('Message is required'); return }
    if(!email.trim() && !phone.trim()){ setMsg('Provide email or phone'); return }
    try{
      const body = { name, message }
      if (email.trim()) body.contact = email.trim()
      if (phone.trim()) body.phone = phone.trim()
      if (to && to.email) body.to = to.email
      const r=await fetch(`${API}/public/contact`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body)
      })
      if(!r.ok){ const t=await r.text(); setMsg(t||'ERROR'); return }
      setMsg('Sent.'); setTimeout(()=> { onClose(); if(typeof onSent==='function') onSent() }, 400)
    }catch{ setMsg('ERROR') }
  }
  return (
    <form onSubmit={send} style={{display:'grid',gap:10,textAlign:'left'}}>
      {to && <div className="muted">To: <b>{to.name||to.email}</b></div>}
      <div style={{display:'grid',gridTemplateColumns:'140px 1fr',gap:8,alignItems:'center'}}>
        <div>Name</div>
        <input className="input" value={name} onChange={e=>setName(e.target.value)} />
        <div>Email</div>
        <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <div>Phone</div>
        <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} />
        <div>Message</div>
        <textarea className="input" value={message} onChange={e=>setMessage(e.target.value)} rows={5} />
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end',alignItems:'center'}}>
        <span className="muted" style={{flex:1}}>{msg}</span>
        <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" type="submit">Send</button>
      </div>
    </form>
  )
}
