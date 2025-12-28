import React, { useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function Reports(){
  const [token,setToken]=useState(localStorage.getItem('tf_token')||'')
  const auth = token ? { 'Authorization':'Bearer '+token } : {}
  const [start,setStart]=useState(()=>new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10))
  const [end,setEnd]=useState(()=>new Date().toISOString().slice(0,10))
  const [resource,setResource]=useState('')
  const [user,setUser]=useState('')
  const [rows,setRows]=useState([])
  const [totH,setTotH]=useState(0)
  const [totE,setTotE]=useState(0)
  const [msg,setMsg]=useState('')
  const [sort,setSort]=useState({ key:'start_ts', dir:'asc' })

  async function run(){
    if(!token){ setMsg('LOGIN IN ADMIN PAGE FIRST'); return }
    setMsg('Running…')
    const qs = new URLSearchParams({ start: start+'T00:00:00Z', end: end+'T23:59:59Z' })
    if(resource) qs.set('resource',resource)
    if(user) qs.set('user',user)
    const r = await fetch(`${API}/admin/report?`+qs.toString(), { headers: auth })
    const j = await r.json()
    if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setRows(j.rows||[]); setTotH(j.total_hours||0); setTotE(j.total_eur||0); setMsg('')
  }

  function dlCSV(){
    const qs = new URLSearchParams({ start: start+'T00:00:00Z', end: end+'T23:59:59Z', format:'csv' })
    if(resource) qs.set('resource',resource)
    if(user) qs.set('user',user)
    window.location.href = `${API}/admin/report?`+qs.toString()+'&token='+encodeURIComponent(token) // not used by API; just a hint if you proxy
  }

  function sortBy(key){ setSort(s=> ({ key, dir: s.key===key && s.dir==='asc' ? 'desc' : 'asc' })) }
  const arrow = (key)=> sort.key===key ? (sort.dir==='asc'?' ▲':' ▼') : ' ↕'
  const sorted = [...rows].sort((a,b)=>{
    const { key, dir } = sort
    let va = a[key]; let vb = b[key]
    if(key.endsWith('_ts')){ va = new Date(va).getTime(); vb = new Date(vb).getTime() }
    if(typeof va==='string') va = va.toLowerCase(); if(typeof vb==='string') vb = vb.toLowerCase()
    const cmp = va<vb? -1 : (va>vb? 1 : 0)
    return dir==='asc'? cmp : -cmp
  })

  return (
    <div>
      <h2>Reports</h2>
      <p style={{color:'#666'}}>{msg}</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <label>Start <input type="date" value={start} onChange={e=>setStart(e.target.value)} /></label>
        <label>End <input type="date" value={end} onChange={e=>setEnd(e.target.value)} /></label>
        <label>Resource <input value={resource} onChange={e=>setResource(e.target.value)} placeholder="NMR300 (optional)"/></label>
        <label>User <input value={user} onChange={e=>setUser(e.target.value)} placeholder="email (optional)"/></label>
        <button onClick={run}>Run</button>
        <button onClick={dlCSV}>Download CSV</button>
      </div>
      <p>Total hours: {totH.toFixed(2)} · Total €: {Number(totE).toFixed(2)}</p>
      <table>
        <thead><tr>
          <th onClick={()=>sortBy('id')} style={{cursor:'pointer'}}>ID{arrow('id')}</th>
          <th onClick={()=>sortBy('user_email')} style={{cursor:'pointer'}}>User{arrow('user_email')}</th>
          <th onClick={()=>sortBy('resource')} style={{cursor:'pointer'}}>Res{arrow('resource')}</th>
          <th onClick={()=>sortBy('start_ts')} style={{cursor:'pointer'}}>Start{arrow('start_ts')}</th>
          <th onClick={()=>sortBy('end_ts')} style={{cursor:'pointer'}}>End{arrow('end_ts')}</th>
          <th onClick={()=>sortBy('hours')} style={{cursor:'pointer'}}>Hours{arrow('hours')}</th>
          <th onClick={()=>sortBy('rate_code')} style={{cursor:'pointer'}}>Rate{arrow('rate_code')}</th>
          <th onClick={()=>sortBy('price_eur')} style={{cursor:'pointer'}}>€{arrow('price_eur')}</th>
        </tr></thead>
        <tbody>
          {sorted.map(r=>
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.user_email}</td>
              <td>{r.resource}</td>
              <td>{new Date(r.start_ts).toLocaleString()}</td>
              <td>{new Date(r.end_ts).toLocaleString()}</td>
              <td>{Number(r.hours).toFixed(2)}</td>
              <td>{r.rate_code||''}</td>
              <td>{r.price_eur||0}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
