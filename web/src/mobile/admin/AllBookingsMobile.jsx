import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AllBookingsMobile({ token }){
  const [rows,setRows]=useState([])
  const [limit,setLimit]=useState(500)
  const [msg,setMsg]=useState('')
  useEffect(()=>{ load() },[])
  async function load(){
    setMsg('Loading...')
    try{
      const r=await fetch(`${API}/admin/reservations/all?limit=${limit}`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json()
      setRows(Array.isArray(j)?j:[])
      setMsg('')
    }catch{
      setMsg('Failed')
    }
  }
  return (
    <div>
      <div className="card" style={{padding:12,display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <span className="muted">Limit</span>
        <input className="input" type="number" value={limit} onChange={e=>setLimit(e.target.value)} style={{width:100}}/>
        <button className="btn" onClick={load}>Reload</button>
        <span className="muted">{msg}</span>
      </div>
      <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
        {rows.map(r=> (
          <li key={r.id} className="card" style={{padding:12}}>
            <div><strong>{r.resource}</strong> · {new Date(r.start_ts).toLocaleString()} → {new Date(r.end_ts).toLocaleString()}</div>
            <div className="muted" style={{fontSize:12}}>{r.user_email} · {r.experiment} · {r.probe} · {r.status} · €{r.price_eur || ''} · {r.rate_code || ''}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

