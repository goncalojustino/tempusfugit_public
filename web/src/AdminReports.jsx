import React, { useEffect, useMemo, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminReports({token}){
  const [msg,setMsg]=useState('')
  const now = useMemo(()=> new Date(),[])
  const defaultStart = useMemo(()=> `${now.getFullYear()}-01-01`,[now])
  const defaultEnd = useMemo(()=> now.toISOString().slice(0,10),[now])
  const [q,setQ]=useState({start: defaultStart, end: defaultEnd, resource:'', user:''})
  const [resources,setResources]=useState([])

  useEffect(()=>{
    fetch(`${API}/resources`)
      .then(res=> res.ok ? res.json() : [])
      .then(list=> setResources(Array.isArray(list)? list.map(x=> x.name||'').filter(Boolean) : []))
      .catch(()=> setResources([]))
  },[])

  async function downloadCsv(params,label){
    setMsg('Preparing…')
    const isClient = params && params.path==='client'
    if(params) delete params.path
    const url = new URL(`${API}${isClient?'/admin/client_report':'/admin/report'}` , window.location.origin)
    for(const [k,v] of Object.entries(params)) if(v) url.searchParams.set(k,String(v))
    url.searchParams.set('format','csv')
    try{
      const r=await fetch(url.toString(),{ headers:{'Authorization':'Bearer '+token} })
      const blob=await r.blob()
      if(!r.ok){ const t=await blob.text(); setMsg(t||'ERROR'); return }
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`report_${label||'download'}.csv`; a.click(); URL.revokeObjectURL(a.href)
      setMsg('')
    }catch(e){ setMsg('Failed to download') }
  }

  async function downloadAudit(){
    setMsg('Preparing audit CSV…')
    try{
      const url = `${API}/admin/audit/export`
      const r=await fetch(url,{ headers:{'Authorization':'Bearer '+token} })
      const blob=await r.blob()
      if(!r.ok){ const t=await blob.text(); setMsg(t||'ERROR'); return }
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='audit.csv'; a.click(); URL.revokeObjectURL(a.href)
      setMsg('')
    }catch(e){ setMsg('Failed to download audit') }
  }

  return (
    <div>
      <h3>Reports</h3>
      <p>{msg}</p>
      <div style={{display:'grid',gap:8,alignItems:'end',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))'}}>
        <label>Start date
          <input type="date" value={q.start} onChange={e=>setQ({...q,start:e.target.value})} />
        </label>
        <label>End date
          <input type="date" value={q.end} onChange={e=>setQ({...q,end:e.target.value})} />
        </label>
        <label>Resource
          <select value={q.resource} onChange={e=>setQ({...q,resource:e.target.value})}>
            <option value="">All resources</option>
            {resources.map(r=> <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>User (email)
          <input value={q.user} onChange={e=>setQ({...q,user:e.target.value})} placeholder="user@example.org"/>
        </label>
      </div>
      <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
        <button onClick={()=>downloadCsv(q,'filtered')}>Download CSV</button>
        <button onClick={()=>downloadCsv({...q, group:'lab'},'per_lab')}>Download per-lab CSV</button>
        <button onClick={()=>{
          const end=new Date(); const start=new Date(end.getTime()-30*86400000)
          const toISO=(d)=> d.toISOString().slice(0,10)
          downloadCsv({start:toISO(start),end:toISO(end)},'last30days')
        }}>Download last 30 days CSV</button>
        <button onClick={downloadAudit}>Download audit CSV (with IP)</button>
      </div>

      <div style={{marginTop:16, borderTop:'1px solid var(--border)'}} />
      <h3 style={{marginTop:16}}>Client Reports</h3>
      <div className="muted" style={{marginBottom:8}}>Contains only bookings billed to clients; lab-billed excluded above.</div>
      <div style={{display:'grid',gap:8,alignItems:'end',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))'}}>
        <label>Start date
          <input type="date" value={q.start} onChange={e=>setQ({...q,start:e.target.value})} />
        </label>
        <label>End date
          <input type="date" value={q.end} onChange={e=>setQ({...q,end:e.target.value})} />
        </label>
        <label>Resource
          <select value={q.resource} onChange={e=>setQ({...q,resource:e.target.value})}>
            <option value="">All resources</option>
            {resources.map(r=> <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>
      <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
        <button onClick={()=>downloadCsv({start:q.start,end:q.end,resource:q.resource,path:'client'},'client_detailed')}>Download client CSV</button>
        <button onClick={()=>downloadCsv({start:q.start,end:q.end,resource:q.resource,group:'client',path:'client'},'client_per_client')}>Download per-client CSV</button>
      </div>
    </div>
  )
}
