import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function Register(){
  const [email,setEmail]=useState('')
  const [name,setName]=useState('')
  const [lab,setLab]=useState('')
  const [labs,setLabs]=useState([])
  const [msg,setMsg]=useState('')
  useEffect(()=>{
    fetch(`${API}/public/labs`).then(r=>r.json()).then(j=> Array.isArray(j)&&setLabs(j)).catch(()=>{})
  },[])
  async function submit(e){
    e.preventDefault(); setMsg('Submitting…')
    try{
      const r=await fetch(`${API}/public/register_request`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email,name,lab}) })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
      setMsg('Submitted. Admins will review your request.')
      setEmail(''); setName(''); setLab('')
    }catch{ setMsg('ERROR') }
  }
  return (
    <div className="container" style={{maxWidth:560}}>
      <h2>Request access</h2>
      <form onSubmit={submit} className="card" style={{padding:16,display:'grid',gap:12}}>
        <label style={{display:'grid',gap:6}}>
          <span style={{fontSize:12,color:'var(--muted)'}}>Email</span>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} required/>
        </label>
        <label style={{display:'grid',gap:6}}>
          <span style={{fontSize:12,color:'var(--muted)'}}>Name</span>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} required/>
        </label>
        <label style={{display:'grid',gap:6}}>
          <span style={{fontSize:12,color:'var(--muted)'}}>Lab</span>
          <select className="select" value={lab} onChange={e=>setLab(e.target.value)} required>
            <option value="">-- choose lab --</option>
            {labs.map(l=> <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        </label>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button className="btn" disabled={!email || !name || !lab}>Submit</button>
          <span className="muted">{msg}</span>
        </div>
      </form>
    </div>
  )
}
