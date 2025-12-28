import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
const API = import.meta.env.VITE_API_URL || '/api'

const statusStyle = (s)=> {
  if(s==='OK') return { badge:'●', color:'var(--c-teal-500)', overlay:'rgba(10,147,150,0.12)', label:'Operational' }
  if(s==='LIMITED') return { badge:'●', color:'var(--c-amber)', overlay:'rgba(238,155,0,0.12)', label:'Limited' }
  return { badge:'●', color:'var(--c-oxblood)', overlay:'rgba(155,34,38,0.10)', label:'Down' }
}

export default function Home({ token, role, email, onLogout }){
  const nav = useNavigate()
  const [res,setRes]=useState([])
  const [msg,setMsg]=useState('')
  const [bulletin,setBulletin]=useState({ text:'', by:'', at:'', resources:[] })
  const [staff,setStaff]=useState([])
  const [showContact,setShowContact]=useState(false)
  const [contactTo,setContactTo]=useState(null)
  const [changes,setChanges]=useState('')
  const [showChanges,setShowChanges]=useState(false)
  const [approvalsPrompt,setApprovalsPrompt]=useState({ show:false, bookings:0, registrations:0 })
  const hideApprovalsPrompt = ()=> setApprovalsPrompt({ show:false, bookings:0, registrations:0 })
  useEffect(()=>{
    fetch(`${API}/resources`)
      .then(async r => r.ok ? r.json() : [])
      .then(j=> { setRes(Array.isArray(j)? j : []); setMsg('') })
      .catch(()=> { setRes([]); setMsg('Failed to load resources') })
  },[])
  useEffect(()=>{
    fetch(`${API}/public/bulletin`).then(r=>r.json()).then(j=>{
      const text = String((j && j.text) || '').trim()
      setBulletin({ text, by: j.published_by||'', at: j.published_at||'', resources: Array.isArray(j?.resources)? j.resources : [] })
    }).catch(()=>{})
    fetch(`${API}/public/staff`).then(r=>r.json()).then(j=> Array.isArray(j)&&setStaff(j)).catch(()=>{})
  },[])
  function open(r){ nav(`/grid?resource=${encodeURIComponent(r)}`) }

  // Show CHANGES.txt popup only immediately after login (flag set by Login)
  useEffect(()=>{
    let trigger = false
    try{ trigger = sessionStorage.getItem('tf_show_changes') === 'yes' }catch(_){ trigger = false }
    if(!trigger) return
    try{ sessionStorage.removeItem('tf_show_changes') }catch(_){ }
    fetch(`${API}/public/changes?ts=${Date.now()}`,{ cache:'no-store' })
      .then(r=> r.text())
      .then(t=>{ setChanges(t||''); setShowChanges(true) })
      .catch(()=>{ setChanges(''); setShowChanges(true) })
  },[])

  // Notify staff/DANTE about pending approvals immediately after login
  useEffect(()=>{
    let shouldCheck = false
    const normalizedRole = String(role||'').toUpperCase()
    try{ shouldCheck = sessionStorage.getItem('tf_check_approvals') === 'yes' }catch(_){ shouldCheck = false }
    if(!shouldCheck || !token || !['STAFF','DANTE'].includes(normalizedRole)) return
    try{ sessionStorage.removeItem('tf_check_approvals') }catch(_){ }

    const headers = { 'Authorization': 'Bearer ' + token }
    Promise.all([
      fetch(`${API}/admin/registration_requests`, { headers }),
      fetch(`${API}/admin/reservations/pending`, { headers }),
    ]).then(async ([regRes, bookRes])=>{
      let registrations = 0
      let bookings = 0
      if(regRes.ok){
        const payload = await regRes.json()
        if(Array.isArray(payload)) registrations = payload.length
      }else{
        await regRes.text()
      }
      if(bookRes.ok){
        const payload = await bookRes.json()
        if(Array.isArray(payload)) bookings = payload.length
      }else{
        await bookRes.text()
      }
      if(registrations>0 || bookings>0){
        setApprovalsPrompt({ show:true, bookings, registrations })
      }
    }).catch(()=>{
      /* ignore fetch errors for the prompt */
    })
  },[role, token])

  return (
    <div>
      <Nav token={token} email={email} role={role} onLogout={onLogout}/>
      <div className="container">
        {(bulletin.text || staff.length>0 || (bulletin.resources||[]).length>0) && (
          <div style={{margin:'12px 0', padding:12, background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:8}}>
            <div style={{fontWeight:700, marginBottom:6, textAlign:'center'}}>Bulletin</div>
            {bulletin.text && (<div style={{color:'var(--text)'}}>{bulletin.text}</div>)}
            {(bulletin.text && bulletin.by && bulletin.at) ? (
              <div style={{marginTop:6, fontSize:12, color:'var(--muted)'}}>
                Published by {bulletin.by} at {new Date(bulletin.at).toLocaleString()}
              </div>
            ) : null}
            <div style={{marginTop:10}}>
              <div style={{fontSize:12, color:'var(--muted)', marginBottom:4}}>Resource status</div>
              <ul style={{margin:0, paddingLeft:18}}>
                {((bulletin.resources&&bulletin.resources.length)? bulletin.resources : res.map(r=>({name:r.name,status:r.status,note:r.limitation_note})) ).map((r,i)=> (
                  <li key={i}><span style={{fontWeight:600}}>{r.name}</span>: {r.status}{r.note?` - ${r.note}`:''}</li>
                ))}
              </ul>
            </div>
            <div style={{marginTop:8, display:'flex', justifyContent:'center', gap:12, flexWrap:'wrap'}}>
              <Link to="/display" style={{fontWeight:700}}>Current usage</Link>
              <a href="/mobile/login" style={{fontWeight:700}}>Mobile version</a>
            </div>
            <div style={{marginTop:12, borderTop:'1px solid var(--border)'}} />
            <div style={{marginTop:10, fontSize:12, color:'var(--muted)', textAlign:'center'}}>
              <div style={{marginBottom:6}}>Staff contacts</div>
              <div>
                {staff.map((s,i)=> (
                  <button key={i} onClick={()=>{ setContactTo({email:s.email, name:s.name||s.email}); setShowContact(true) }}
                          style={{background:'none',border:'1px solid var(--border)',padding:'6px 10px',borderRadius:8,color:'var(--accent)',cursor:'pointer',textDecoration:'none',margin:'4px'}}>
                    {s.name||s.email}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <h2 style={{margin:'8px 0'}}>Resources</h2>
        <p className="muted" style={{minHeight:18}}>{msg}</p>
        <div className="card-list">
          {res.map(r=>{
            const st = statusStyle(r.status||'OK')
            return (
              <div key={r.name} onClick={()=>open(r.name)} className="card" style={{cursor:'pointer',overflow:'hidden', borderColor: st.color, borderWidth: 2}}>
                <div className="card-thumb" style={{background: (r.color_hex && r.color_hex.trim()) ? r.color_hex.trim() : st.overlay}}>
                  <div className="status-dot" style={{color:st.color}} title={st.label}>{st.badge}</div>
                </div>
                <div className="section" style={{display:'flex',justifyContent:'space-between',alignItems:'center', background: st.overlay}}>
                  <div>
                    <div style={{fontWeight:600}}>{r.name}</div>
                    <div style={{fontSize:12, color:'var(--muted)'}}>
                      <span className={`badge ${r.status==='OK'?'ok':(r.status==='LIMITED'?'limited':'down')}`}>{st.label}</span>
                      {r.limitation_note ? ` · ${r.limitation_note}` : ''}
                    </div>
                  </div>
                  <div title={`Advance window: ${r.advance_days} days`} style={{fontSize:12,color:'var(--muted)'}}>{r.advance_days}d</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {showContact && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'grid',placeItems:'center',zIndex:1000}}>
          <div style={{width:520,background:'#fff',borderRadius:12,padding:16,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}}>
            <h3 style={{marginTop:0}}>Contact staff</h3>
            <ContactForm to={contactTo} onClose={()=>setShowContact(false)} />
          </div>
        </div>
      )}
      <Footer/>
      {approvalsPrompt.show && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'grid',placeItems:'center',zIndex:1300}}>
          <div style={{width:420,maxWidth:'90vw',background:'#fff',borderRadius:12,padding:20,boxShadow:'0 10px 30px rgba(0,0,0,0.25)',display:'grid',gap:16}}>
            <div>
              <h3 style={{margin:'0 0 8px'}}>Pending approvals require attention</h3>
              <p style={{margin:0}}>Bookings pending approval: <strong>{approvalsPrompt.bookings}</strong></p>
              <p style={{margin:'4px 0 0'}}>User registrations pending approval: <strong>{approvalsPrompt.registrations}</strong></p>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn secondary" onClick={hideApprovalsPrompt}>Later</button>
              <button className="btn" onClick={()=>{ hideApprovalsPrompt(); nav('/admin#APPROVALS') }}>Open approvals</button>
            </div>
          </div>
        </div>
      )}
      {(showChanges) && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'grid',placeItems:'center',zIndex:1200}}>
          <div style={{width:700,maxWidth:'90vw',maxHeight:'80vh',overflow:'auto',background:'#fff',borderRadius:12,padding:16,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}}>
            <h3 style={{marginTop:0}}>Recent Changes</h3>
            <pre style={{whiteSpace:'pre-wrap',fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',fontSize:13,background:'#f9fafb',border:'1px solid #e5e7eb',padding:12,borderRadius:8,maxHeight:'56vh',overflow:'auto'}}>{changes || 'No changes listed.'}</pre>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={()=>{ setShowChanges(false) }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ContactForm({ to, onClose }){
  const API = import.meta.env.VITE_API_URL || '/api'
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
      if(email.trim()) body.contact = email.trim()
      if(phone.trim()) body.phone = phone.trim()
      if (to && to.email) body.to = to.email
      const r=await fetch(`${API}/public/contact`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if(!r.ok){ const t=await r.text(); setMsg(t||'ERROR'); return }
      setMsg('Sent.'); setTimeout(()=> onClose(), 600)
    }catch{ setMsg('ERROR') }
  }
  return (
    <form onSubmit={send} style={{display:'grid',gap:10,textAlign:'left'}}>
      {to && <div className="muted">To: <b>{to.name||to.email}</b></div>}
      <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:8,alignItems:'center'}}>
        <div style={{textAlign:'right'}}>Name</div>
        <input className="input" value={name} onChange={e=>setName(e.target.value)} />
        <div style={{textAlign:'right'}}>Email</div>
        <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <div style={{textAlign:'right'}}>Phone</div>
        <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} />
        <div style={{textAlign:'right'}}>Message</div>
        <textarea className="input" value={message} onChange={e=>setMessage(e.target.value)} rows={5} />
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <span className="muted" style={{flex:1}}>{msg}</span>
        <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" type="submit">Send</button>
      </div>
    </form>
  )
}
