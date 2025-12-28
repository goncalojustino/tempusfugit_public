import React, { useEffect, useState } from 'react'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
const API = import.meta.env.VITE_API_URL || '/api'

const fmtDT = (d)=> {
  const x = new Date(d)
  const pad = n=> String(n).padStart(2,'0')
  return `${pad(x.getDate())}/${pad(x.getMonth()+1)}/${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}`
}

export default function My({token,email,role,onLogout}){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  const [pendingId,setPendingId]=useState(null)
  const [sort,setSort]=useState({ key:'start_ts', dir:'desc' })
  const [err,setErr]=useState(null)
  const [showErr,setShowErr]=useState(false)

  async function load(){
    if(!token||!email){ setRows([]); return }
    setMsg('Loading…')
    try{
      const r=await fetch(`${API}/me/upcoming`,{ headers:{'X-User-Email':email,'Authorization':'Bearer '+token} })
      const j=await r.json()
      if(!r.ok){ setMsg(j.error||'Failed to load bookings'); setRows([]); return }
      setRows(Array.isArray(j)?j:[]); setMsg('')
    }catch{ setRows([]); setMsg('Failed to load bookings') }
  }
  useEffect(()=>{ load() },[token,email])

  function sortBy(key){ setSort(s=> ({ key, dir: s.key===key && s.dir==='asc' ? 'desc' : 'asc' })) }
  const arrow = (key)=> sort.key===key ? (sort.dir==='asc' ? ' ▲' : ' ▼') : ' ↕'
  const sorted = [...rows].sort((a,b)=>{
    const { key, dir } = sort
    let va = a[key] || a.start_ts || a.start
    let vb = b[key] || b.start_ts || b.start
    if(key.includes('start') || key.includes('end')){ va = new Date(va).getTime(); vb = new Date(vb).getTime() }
    if(typeof va==='string') va = va.toLowerCase(); if(typeof vb==='string') vb = vb.toLowerCase()
    const cmp = va<vb? -1 : (va>vb? 1 : 0)
    return dir==='asc'? cmp : -cmp
  })

  const statusLabel = (r)=>{
    const by = String(r.canceled_by||'').toLowerCase()
    const owner = String(r.user_email||email||'').toLowerCase()
    if(r.status==='PENDING') return 'Pending approval'
    if(r.status==='CANCEL_PENDING') return 'Cancellation pending review'
    if(r.status==='CANCELED'){
      if(by && by !== owner) return 'Denied by staff'
      return 'Canceled'
    }
    return r.status
  }

  async function doCancel(){
    if(!pendingId) return
    setMsg('Cancelling…')
    const r=await fetch(`${API}/reservations/cancel`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({id: pendingId, email})
    })
    const raw = await r.text(); let j=null; try{ j = raw? JSON.parse(raw) : null }catch(_){ }
    if(!r.ok){ setMsg((j?.error||raw||'ERROR')); setErr(j||{raw}); setShowErr(false); setPendingId(null); return }
    setMsg('Cancelled'); setPendingId(null); load()
  }

  return (
    <div>
      <Nav token={token} email={email} role={role} onLogout={onLogout}/>
      <div style={{padding:16}}>
        <h2>My bookings</h2>
        <p>{msg}</p>
        <table>
          <thead><tr>
            <th onClick={()=>sortBy('id')} style={{cursor:'pointer'}}>ID{arrow('id')}</th>
            <th onClick={()=>sortBy('resource')} style={{cursor:'pointer'}}>Resource{arrow('resource')}</th>
            <th onClick={()=>sortBy('start_ts')} style={{cursor:'pointer'}}>Start{arrow('start_ts')}</th>
            <th onClick={()=>sortBy('end_ts')} style={{cursor:'pointer'}}>End{arrow('end_ts')}</th>
            <th onClick={()=>sortBy('experiment')} style={{cursor:'pointer'}}>Exp{arrow('experiment')}</th>
            <th onClick={()=>sortBy('probe')} style={{cursor:'pointer'}}>Probe{arrow('probe')}</th>
            <th onClick={()=>sortBy('status')} style={{cursor:'pointer'}}>Status{arrow('status')}</th>
            <th></th>
          </tr></thead>
          <tbody>
            {sorted.map(r=>
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.resource}</td>
                <td>{fmtDT(r.start_ts||r.start)}</td>
                <td>{fmtDT(r.end_ts||r.end)}</td>
                <td>{r.experiment}</td>
                <td>{r.probe}</td>
                <td>{statusLabel(r)}</td>
                <td>{(r.status==='APPROVED' && new Date(r.start_ts||r.start) > new Date()) ? <button onClick={()=>setPendingId(r.id)}>Cancel</button> : null}</td>
              </tr>
            )}
          </tbody>
        </table>

        {err && (
          <div className="card" style={{padding:12, marginTop:12, borderColor:'#FCA5A5'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <strong style={{color:'#991B1B'}}>Last error</strong>
              <button className="btn secondary" onClick={()=>setShowErr(s=>!s)}>{showErr?'Hide details':'View details'}</button>
            </div>
            {showErr && (
              <pre style={{whiteSpace:'pre-wrap',fontSize:12,marginTop:8,maxHeight:220,overflow:'auto'}}>{JSON.stringify(err,null,2)}</pre>
            )}
          </div>
        )}

        {pendingId && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'grid',placeItems:'center',zIndex:1000}}>
            <div style={{background:'#fff',padding:16,borderRadius:8,minWidth:320}}>
              <h3>Confirm cancellation</h3>
              <p>Cancel booking ID <b>{pendingId}</b>?</p>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button onClick={()=>setPendingId(null)}>Go back</button>
                <button onClick={doCancel}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer/>
    </div>
  )
}
