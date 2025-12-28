import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
const API = import.meta.env.VITE_API_URL || '/api'

export default function Nav({ token, email, role, onLogout }){
  const nav = useNavigate()
  const [me,setMe]=useState({name:'',lab:''})
  const [pending,setPending]=useState({ users:0, bookings:0 })
  const [hideBanner,setHideBanner]=useState(()=>{ try{ return sessionStorage.getItem('tf_hide_pending_banner')==='1' }catch(_){ return false } })
  const auth = useAuth()
  const impersonator = useMemo(()=> (typeof window !== 'undefined' ? auth?.getImpersonator?.() : null), [auth])
  const isImpersonating = Boolean(impersonator)
  useEffect(()=>{
    if(!token) return
    fetch(`${API}/me`,{ headers:{'Authorization':'Bearer '+token} })
      .then(async r=> r.ok? r.json(): null).then(j=> j && setMe(j)).catch(()=>{})
  },[token])
  useEffect(()=>{
    if(!token || !['STAFF','DANTE'].includes(role)) return
    Promise.all([
      fetch(`${API}/admin/registration_requests`, { headers:{'Authorization':'Bearer '+token} }).then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch(`${API}/admin/reservations/pending`, { headers:{'Authorization':'Bearer '+token} }).then(r=>r.ok?r.json():[]).catch(()=>[]),
    ]).then(([reg,resv])=>{
      setPending({ users: Array.isArray(reg)? reg.length:0, bookings: Array.isArray(resv)? resv.length:0 })
    }).catch(()=> setPending({ users:0, bookings:0 }))
  },[token,role])
  // Easter eggs disabled permanently
  function doLogout(){
    if (confirm('Log out?')) { onLogout(); nav('/login',{replace:true}) }
  }
  return (
    <>
      <div className="nav">
        <img src={(import.meta.env.VITE_API_URL||'/api') + '/public/logo'} alt="logo" style={{height:'100%',maxHeight:40,marginRight:8,objectFit:'contain'}} onError={(e)=>{ e.currentTarget.style.display='none' }}/>
        <em style={{fontWeight:600}}>tempusfugit</em>
        <span>|</span><Link to="/">Home</Link>
        <span>|</span><Link to="/grid">Book</Link>
        <span>|</span><Link to="/my">My bookings</Link>
        <span>|</span><Link to="/account">Account</Link>
        <span>|</span><a href="/tempusfugit_user_manual.md" target="_blank" rel="noreferrer">User manual</a>
        {['STAFF','DANTE'].includes(role) && (<><span>|</span><Link to="/admin">Admin</Link></>)}
      <div className="spacer" />
      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        <span className="muted">{me.name||''} · {email} · {me.lab||''} · {role||'—'}</span>
        <button className="btn secondary" onClick={doLogout}>Logout</button>
      </div>
      </div>
      {isImpersonating && (
        <div style={{background:'#7f1d1d', color:'#fff', padding:'10px 16px', display:'flex', alignItems:'center', gap:16}}>
          <div style={{fontWeight:600}}>
            {impersonator || 'Unknown'} is impersonating {email}.
          </div>
          <div className="spacer" />
          <button
            onClick={()=>{
              auth?.stopImpersonating?.().catch(err => {
                console.error('Failed to stop impersonation', err)
                alert(err?.message || 'Failed to stop impersonation')
              })
            }}
            className="btn"
            style={{background:'#b91c1c', borderColor:'rgba(255,255,255,0.4)', color:'#fff'}}
          >
            Stop impersonating
          </button>
        </div>
      )}
      {['STAFF','DANTE'].includes(role) && !hideBanner && (pending.users>0 || pending.bookings>0) && (
        <div style={{background:'#fffbe6', borderBottom:'1px solid #fcd34d', color:'#7c3e00', padding:'6px 12px', display:'flex', alignItems:'center', gap:10}}>
          <div>
            Pending approvals: <b>{pending.users}</b> users · <b>{pending.bookings}</b> bookings
            {' '}<Link to="/admin#APPROVALS_MAILS" style={{marginLeft:8}}>Review now</Link>
          </div>
          <div className="spacer" />
          <button onClick={()=>{ setHideBanner(true); try{ sessionStorage.setItem('tf_hide_pending_banner','1') }catch(_){}}}
                  title="Dismiss" style={{background:'none', border:'none', cursor:'pointer', fontSize:16, lineHeight:1}}>×</button>
        </div>
      )}
    </>
  )
}
