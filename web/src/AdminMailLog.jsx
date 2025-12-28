import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminMailLog({ token }){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  const [sort,setSort]=useState({ key:'ts', dir:'desc' })

  async function load(){
    setMsg('Loading…')
    try{
      const r=await fetch(`${API}/admin/notify/log`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); setRows([]); return }
      setRows(Array.isArray(j)?j:[]); setMsg('')
    }catch{ setRows([]); setMsg('Failed to load') }
  }
  useEffect(()=>{ load() },[])

  function sortBy(key){ setSort(s=> ({ key, dir: s.key===key && s.dir==='asc' ? 'desc' : 'asc' })) }
  const sorted = [...rows].sort((a,b)=>{
    const { key, dir } = sort
    let va = a[key]; let vb = b[key]
    if(key==='ts'){ va = va? new Date(va).getTime():0; vb = vb? new Date(vb).getTime():0 }
    if(typeof va==='string') va = va.toLowerCase(); if(typeof vb==='string') vb = vb.toLowerCase()
    const cmp = va<vb? -1 : (va>vb? 1 : 0)
    return dir==='asc'? cmp : -cmp
  })

  const arrow = (key)=> sort.key===key ? (sort.dir==='asc'?' ▲':' ▼') : ' ↕'
  return (
    <div>
      <h3>Broadcast mail log</h3>
      <p className="muted">Shows recent broadcast emails. Subjects are prefilled with "<CHANGE:facility_name>".</p>
      <p>{msg}</p>
      <table>
        <thead><tr>
          <th onClick={()=>sortBy('ts')} style={{cursor:'pointer'}}>When{arrow('ts')}</th>
          <th onClick={()=>sortBy('actor')} style={{cursor:'pointer'}}>Actor{arrow('actor')}</th>
          <th onClick={()=>sortBy('subject')} style={{cursor:'pointer'}}>Subject{arrow('subject')}</th>
          <th onClick={()=>sortBy('recipients')} style={{cursor:'pointer'}}>Recipients{arrow('recipients')}</th>
        </tr></thead>
        <tbody>
          {sorted.map(r=>
            <tr key={r.id}>
              <td>{new Date(r.ts).toLocaleString()}</td>
              <td>{r.actor||''}</td>
              <td>{r.subject||''}</td>
              <td>{r.recipients||0}</td>
            </tr>
          )}
        </tbody>
      </table>
      <button onClick={load}>Refresh</button>
    </div>
  )
}
