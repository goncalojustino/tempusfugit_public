import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminApprovals({token, onCountChange}){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  const [sort,setSort]=useState({ key:'start_ts', dir:'asc' })

  async function load(){
    setMsg('Loading…')
    try{
      const r=await fetch(`${API}/admin/reservations/pending`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); setRows([]); onCountChange?.(0); return }
      const list = Array.isArray(j)?j:[]
      setRows(list); setMsg(''); onCountChange?.(list.length)
    }catch{
      setRows([]); setMsg('Failed to load pending'); onCountChange?.(0)
    }
  }
  useEffect(()=>{ load() },[token])

  async function act(id,action){
    setMsg(action+'…')
    const r=await fetch(`${API}/admin/reservations/${action}`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({id})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    load()
  }

  const fmt=(d)=> new Date(d).toLocaleString()
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
      <h3>Approvals</h3>
      <p>{msg}</p>
      <table>
        <thead><tr>
          <th onClick={()=>sortBy('id')} style={{cursor:'pointer'}}>ID{arrow('id')}</th>
          <th onClick={()=>sortBy('user_email')} style={{cursor:'pointer'}}>User{arrow('user_email')}</th>
          <th onClick={()=>sortBy('resource')} style={{cursor:'pointer'}}>Resource{arrow('resource')}</th>
          <th onClick={()=>sortBy('start_ts')} style={{cursor:'pointer'}}>Start{arrow('start_ts')}</th>
          <th onClick={()=>sortBy('end_ts')} style={{cursor:'pointer'}}>End{arrow('end_ts')}</th>
          <th onClick={()=>sortBy('experiment')} style={{cursor:'pointer'}}>Exp{arrow('experiment')}</th>
          <th onClick={()=>sortBy('probe')} style={{cursor:'pointer'}}>Probe{arrow('probe')}</th>
          <th onClick={()=>sortBy('price_eur')} style={{cursor:'pointer'}}>€{arrow('price_eur')}</th>
          <th></th>
        </tr></thead>
        <tbody>
          {sorted.map(r=>
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.user_email}</td>
              <td>{r.resource}</td>
              <td>{fmt(r.start_ts)}</td>
              <td>{fmt(r.end_ts)}</td>
              <td>{r.experiment}</td>
              <td>{r.probe}</td>
              <td>{r.price_eur}</td>
              <td>
                <button onClick={()=>act(r.id,'approve')}>Approve</button>
                <button onClick={()=>act(r.id,'deny')}>Deny</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button onClick={load}>Refresh</button>
    </div>
  )
}
