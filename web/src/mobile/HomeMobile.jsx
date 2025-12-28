import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileNav from './MobileNav.jsx'
const API = import.meta.env.VITE_API_URL || '/api'

export default function HomeMobile({ token, role, email, onLogout }){
  const nav = useNavigate()
  const [res,setRes]=useState([])
  const [msg,setMsg]=useState('')
  const [bulletin,setBulletin]=useState({ text:'', by:'', at:'', resources:[] })
  useEffect(()=>{ localStorage.setItem('tf_view','mobile') },[])
  useEffect(()=>{
    fetch(`${API}/resources`).then(r=>r.json()).then(j=> Array.isArray(j)&&setRes(j)).catch(()=>{})
    fetch(`${API}/public/bulletin`).then(r=>r.json()).then(j=> setBulletin({ text:String(j?.text||'').trim(), by:j?.published_by||'', at:j?.published_at||'', resources: Array.isArray(j?.resources)? j.resources : []})).catch(()=>{})
  },[])
  function open(r){ nav(`/mobile/grid?resource=${encodeURIComponent(r)}`) }
  return (
    <div>
      <MobileNav title="Tempusfugit Mobile" role={role} onSwitchDesktop={()=> nav('/login',{replace:true})} />
      <div className="container">
        {(bulletin.text || (bulletin.resources||[]).length>0) && (
          <div style={{margin:'12px 0', padding:12, background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:8}}>
            <div style={{fontWeight:700, marginBottom:6, textAlign:'center'}}>Bulletin</div>
            {bulletin.text && (<div>{bulletin.text}</div>)}
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
            <div style={{marginTop:8, textAlign:'center'}}>
              <a onClick={()=>nav('/mobile/display')} style={{fontWeight:700, cursor:'pointer'}}>Current usage</a>
            </div>
          </div>
        )}
        <h3>Resources</h3>
        <p className="muted">{msg}</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
          {res.map(r=> (
            <div key={r.name} className="card" style={{padding:12}} onClick={()=>open(r.name)}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:600}}>{r.name}</div>
                  <div className="muted" style={{fontSize:12}}>{r.status}{r.status==='LIMITED' && r.limitation_note?` · ${r.limitation_note}`:''}</div>
                </div>
                <div className="muted" style={{fontSize:12}}>{r.advance_days}d</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
