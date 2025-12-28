import React, { useEffect, useMemo, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

const STATUS_OPTIONS = [
  { value:'', label:'Any status' },
  { value:'APPROVED', label:'Approved (active)' },
  { value:'PENDING', label:'Pending approval' },
  { value:'CANCEL_PENDING', label:'Cancellation pending' },
  { value:'CANCELED', label:'Canceled' },
]

export default function AdminAllBookings({ token }) {
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  const [limit,setLimit]=useState(25)
  const [sort,setSort]=useState({ key:'id', dir:'desc' })
  const [filters,setFilters]=useState({ name:'', email:'', resource:'', status:'' })
  const [resources,setResources]=useState([])
  const [openActive,setOpenActive]=useState(false)
  const [openRemoved,setOpenRemoved]=useState(false)

  useEffect(()=>{
    fetch(`${API}/resources`).then(r=>r.ok?r.json():[]).then(list=>{
      setResources(Array.isArray(list)? list.map(x=> x.name).filter(Boolean) : [])
    }).catch(()=> setResources([]))
  },[])

  async function load({ filters: overrideFilters, limit: overrideLimit } = {}){
    const effectiveFilters = overrideFilters || filters
    const effectiveLimit = overrideLimit == null ? limit : overrideLimit
    setMsg('Loading…')
    try{
      const params = new URLSearchParams()
      params.set('limit', String(effectiveLimit))
      if(effectiveFilters.email) params.set('email', effectiveFilters.email)
      if(effectiveFilters.name) params.set('name', effectiveFilters.name)
      if(effectiveFilters.resource) params.set('resource', effectiveFilters.resource)
      if(effectiveFilters.status) params.set('status', effectiveFilters.status)
      const res = await fetch(`${API}/admin/reservations/all?${params.toString()}`,{ headers:{'Authorization':'Bearer '+token} })
      const data = await res.json()
      if(!res.ok){ setMsg(data.error||'ERROR'); setRows([]); return }
      setRows(Array.isArray(data)? data:[])
      setMsg('')
    }catch(_){ setMsg('Failed to load'); setRows([]) }
  }

  useEffect(()=>{ load() },[token])

  async function cancelFuture(id, email){
    if(!confirm(`Cancel upcoming booking #${id}?`)) return
    try{
      const res=await fetch(`${API}/reservations/cancel`,{
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({id,email})
      })
      const data=await res.json(); if(!res.ok){ alert(data.error||'ERROR'); return }
      load()
    }catch(e){ alert(String(e.message||e)) }
  }

  async function removePast(id){
    const reason = prompt(`Remove past booking #${id} — enter reason (required):`,'')
    if(!reason || !reason.trim()){ alert('Reason is required'); return }
    try{
      const res=await fetch(`${API}/admin/reservations/remove`,{
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({id, reason: reason.trim()})
      })
      const data=await res.json(); if(!res.ok){ alert(data.error||'ERROR'); return }
      load()
    }catch(e){ alert(String(e.message||e)) }
  }

  function sortBy(key){ setSort(s=> ({ key, dir: s.key===key && s.dir==='asc' ? 'desc' : 'asc' })) }

  const sorted = useMemo(()=>{
    const list = [...rows]
    list.sort((a,b)=>{
      const { key, dir } = sort
      let va = a[key]; let vb = b[key]
      if(key.endsWith('_ts') || key==='created_at' || key==='canceled_at' || key==='admin_remove_ts'){
        va = va? new Date(va).getTime() : 0
        vb = vb? new Date(vb).getTime() : 0
      }
      if(typeof va==='string') va = va.toLowerCase()
      if(typeof vb==='string') vb = vb.toLowerCase()
      const cmp = va<vb? -1 : (va>vb? 1 : 0)
      return dir==='asc'? cmp : -cmp
    })
    return list
  },[rows, sort])

  const activeRows = useMemo(()=> sorted.filter(r=> !r.admin_remove_reason), [sorted])
  const removedRows = useMemo(()=> sorted.filter(r=> !!r.admin_remove_reason), [sorted])

  const renderTable = (data, { showRemoval=false } = {}) => {
    const allowActions = !showRemoval
    return (
      <div style={{overflow:'auto'}}>
        <table style={{fontSize:12, minWidth:900}}>
          <thead>
            <tr>
              <th onClick={()=>sortBy('id')} style={{cursor:'pointer'}}>ID{sort.key==='id'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('user_name')} style={{cursor:'pointer'}}>Name{sort.key==='user_name'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('user_email')} style={{cursor:'pointer'}}>Email{sort.key==='user_email'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('resource')} style={{cursor:'pointer'}}>Resource{sort.key==='resource'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('start_ts')} style={{cursor:'pointer'}}>Start{sort.key==='start_ts'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('end_ts')} style={{cursor:'pointer'}}>End{sort.key==='end_ts'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('experiment')} style={{cursor:'pointer'}}>Exp{sort.key==='experiment'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('probe')} style={{cursor:'pointer'}}>Probe{sort.key==='probe'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('label')} style={{cursor:'pointer'}}>Label{sort.key==='label'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('status')} style={{cursor:'pointer'}}>Status{sort.key==='status'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('price_eur')} style={{cursor:'pointer'}}>Price{sort.key==='price_eur'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('rate_code')} style={{cursor:'pointer'}}>Rate{sort.key==='rate_code'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('created_at')} style={{cursor:'pointer'}}>Created{sort.key==='created_at'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('canceled_at')} style={{cursor:'pointer'}}>Cancelled At{sort.key==='canceled_at'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              <th onClick={()=>sortBy('canceled_by')} style={{cursor:'pointer'}}>Cancelled By{sort.key==='canceled_by'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
              {showRemoval && (
                <>
                  <th onClick={()=>sortBy('admin_remove_ts')} style={{cursor:'pointer'}}>Removed At{sort.key==='admin_remove_ts'?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</th>
                  <th>Reason</th>
                </>
              )}
              {allowActions ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {data.map(r => {
              const isPast = new Date(r.end_ts) < new Date()
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.user_name||''}</td>
                  <td>{r.user_email}</td>
                  <td>{r.resource}</td>
                  <td>{new Date(r.start_ts).toLocaleString()}</td>
                  <td>{new Date(r.end_ts).toLocaleString()}</td>
                  <td>{r.experiment}</td>
                  <td>{r.probe}</td>
                  <td>{r.label}</td>
                  <td>{r.status}</td>
                  <td>{r.price_eur}</td>
                  <td>{r.rate_code}</td>
                  <td>{r.created_at? new Date(r.created_at).toLocaleString():''}</td>
                  <td>{r.canceled_at? new Date(r.canceled_at).toLocaleString():''}</td>
                  <td>{r.canceled_by||''}</td>
                  {showRemoval && (
                    <>
                      <td>{r.admin_remove_ts ? new Date(r.admin_remove_ts).toLocaleString() : ''}</td>
                      <td>{r.admin_remove_reason || ''}</td>
                    </>
                  )}
                  {allowActions ? (
                    <td>
                      {isPast
                        ? <button onClick={()=>removePast(r.id)}>Remove</button>
                        : <button onClick={()=>cancelFuture(r.id, r.user_email)}>Cancel</button>}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      <h3>All bookings</h3>
      <p>{msg}</p>
      <div className="card" style={{padding:12, marginBottom:12, display:'grid', gap:12}}>
        <div style={{display:'grid',gap:12,gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))'}}>
          <label style={{display:'grid',gap:6}}>Name
            <input className="input" value={filters.name} onChange={e=>setFilters(f=>({...f,name:e.target.value}))} placeholder="Contains" />
          </label>
          <label style={{display:'grid',gap:6}}>Email
            <input className="input" value={filters.email} onChange={e=>setFilters(f=>({...f,email:e.target.value}))} placeholder="user@example.org" />
          </label>
          <label style={{display:'grid',gap:6}}>Resource
            <select className="select" value={filters.resource} onChange={e=>setFilters(f=>({...f,resource:e.target.value}))}>
              <option value="">Any resource</option>
              {resources.map(r=> <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label style={{display:'grid',gap:6}}>Status
            <select className="select" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>
              {STATUS_OPTIONS.map(opt=> <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </label>
          <label style={{display:'grid',gap:6}}>Limit
            <input className="input" type="number" min="1" max="5000" value={limit}
              onChange={e=>setLimit(Number(e.target.value)||25)} />
          </label>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn" onClick={()=>load()}>Apply filters</button>
          <button className="btn secondary" onClick={()=>{
            const defaults = { name:'', email:'', resource:'', status:'' }
            setFilters(defaults)
            setLimit(25)
            setSort({ key:'id', dir:'desc' })
            load({ filters: defaults, limit:25 })
          }}>Reset</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <div className="section" style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>setOpenActive(o=>!o)}>
          <div style={{fontWeight:700}}>Bookings ({activeRows.length})</div>
          <div style={{color:'var(--muted)'}}>{openActive?'▲':'▼'}</div>
        </div>
        {openActive && (
          <div className="section" style={{borderTop:'1px solid var(--border)'}}>
            {activeRows.length ? renderTable(activeRows) : <div className="muted">No bookings match the current filters.</div>}
          </div>
        )}
      </div>

      <div className="card">
        <div className="section" style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>setOpenRemoved(o=>!o)}>
          <div style={{fontWeight:700}}>Removed bookings ({removedRows.length})</div>
          <div style={{color:'var(--muted)'}}>{openRemoved?'▲':'▼'}</div>
        </div>
        {openRemoved && (
          <div className="section" style={{borderTop:'1px solid var(--border)'}}>
            {removedRows.length ? renderTable(removedRows, { showRemoval:true }) : <div className="muted">No removed bookings match the current filters.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
