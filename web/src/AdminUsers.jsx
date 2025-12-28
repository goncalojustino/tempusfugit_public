import React, { useEffect, useState, useMemo, useCallback } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminUsers({token, includeRegistration=true, actorRole='USER'}){
  const normalizedActorRole = String(actorRole||'').toUpperCase()
  const canAssignDante = normalizedActorRole === 'DANTE'
  const roleChoices = useMemo(() => ([
    { value: 'USER', label: 'USER', disabled: false },
    { value: 'STAFF', label: 'STAFF', disabled: false },
    { value: 'DANTE', label: 'DANTE', disabled: !canAssignDante },
  ]), [canAssignDante])
  const sanitizeRoleSelection = useCallback((value) => {
    const upper = String(value||'').toUpperCase()
    if(upper === 'DANTE' && !canAssignDante) return 'USER'
    return ['USER','STAFF','DANTE'].includes(upper) ? upper : 'USER'
  }, [canAssignDante])
  const [rows,setRows]=useState([])
  const [labs,setLabs]=useState([])
  const [reg,setReg]=useState([])
  const [msg,setMsg]=useState('')
  const [form,setForm]=useState({email:'',role:'USER',lab:'',passcode:''})
  const [sort,setSort]=useState({ key:'email', dir:'asc' })
  const [approveOpen,setApproveOpen] = useState(false)
  const [approve,setApprove] = useState({ email:'', lab:'', role:'USER', allowed_nmr300:false, allowed_nmr400:false, allowed_nmr500:false })
  useEffect(()=>{
    setForm(f=>{
      const nextRole = sanitizeRoleSelection(f.role)
      return nextRole===f.role ? f : {...f, role: nextRole}
    })
  },[sanitizeRoleSelection])
  useEffect(()=>{
    setApprove(a=>{
      const nextRole = sanitizeRoleSelection(a.role)
      return nextRole===a.role ? a : {...a, role: nextRole}
    })
  },[sanitizeRoleSelection])

  // Helper to immutably update a single row by email
  const updateRow = (email, patch) => {
    setRows(prev => prev.map(x => x.email === email ? { ...x, ...patch } : x))
  }

  async function load(){
    setMsg('Loading…')
    try{
      const fetches = [
        fetch(`${API}/admin/users`,{ headers:{'Authorization':'Bearer '+token} }),
        fetch(`${API}/admin/labs`, { headers:{'Authorization':'Bearer '+token} }),
        fetch(`${API}/admin/users/blocked`, { headers:{'Authorization':'Bearer '+token} }),
      ]
      if(includeRegistration){
        fetches.push(fetch(`${API}/admin/registration_requests`, { headers:{'Authorization':'Bearer '+token} }))
      }
      const responses = await Promise.all(fetches)
      const [ru, rl, rb, rrRaw] = includeRegistration ? responses : [...responses, null]
      const [ju, jl, jblk] = await Promise.all([ru.json(), rl.json(), rb.json()])
      const jreg = includeRegistration && rrRaw ? await rrRaw.json() : []
      if(!ru.ok){ setMsg(ju.error||'Failed to load users') }
      if(!rl.ok){ setMsg(prev=> prev||jl.error||'Failed to load labs') }
      if(includeRegistration && rrRaw && !rrRaw.ok){ setMsg(prev=> prev||jreg.error||'Failed to load registration requests') }
      const blocked = new Set((Array.isArray(jblk)?jblk:[]).map(x=> String(x.email||'').toLowerCase()))
      const users = (Array.isArray(ju)?ju:[]).map(u=> ({...u, __blocked: blocked.has(String(u.email||'').toLowerCase()) }))
      setRows(users)
      setLabs(Array.isArray(jl)?jl:[])
      if(includeRegistration) setReg(Array.isArray(jreg)?jreg:[])
      else setReg([])
      const ok = ru.ok && rl.ok && (includeRegistration ? (rrRaw && rrRaw.ok) : true)
      if(ok) setMsg('')
    }catch{
      setRows([]); setLabs([]); if(includeRegistration) setReg([]); setMsg('Failed to load users/labs')
    }
  }
  useEffect(()=>{ load() },[token, includeRegistration])

  async function addUser(e){
    e.preventDefault()
    // Confirm overwrite if email exists
    const exists = rows.some(u=> String(u.email||'').toLowerCase() === String(form.email||'').toLowerCase())
    if(exists && !confirm('Email already exists. This will overwrite existing data. Proceed?')) return
    setMsg('Adding…')
    const r=await fetch(`${API}/admin/users/add`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(form)
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Added'); setForm({email:'',role:'USER',lab:'',passcode:''}); load()
  }

  async function saveUser(u){
    setMsg('Saving…')
    const r=await fetch(`${API}/admin/users/update`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(u)
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Saved');
    // If lab or other user fields changed, refresh to ensure all views update
    window.location.reload()
  }

  async function delUser(email){
    if(!confirm(`Delete ${email}?`)) return
    const r=await fetch(`${API}/admin/users/delete`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({email})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Deleted'); load()
  }

  async function blockUser(email){
    const r=await fetch(`${API}/admin/users/block`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({email}) })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    load()
  }
  async function unblockUser(email){
    const r=await fetch(`${API}/admin/users/unblock`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({email}) })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    load()
  }

  function exportUsersCSV(){
    const header=['email','name','role','lab','allowed_nmr300','allowed_nmr400','allowed_nmr500']
    const lines=[header.join(',')]
    for(const u of rows){
      const vals=[u.email,u.name||'',u.role||'',u.lab||'',!!u.allowed_nmr300,!!u.allowed_nmr400,!!u.allowed_nmr500]
      lines.push(vals.map(v=> String(v).includes(',')? '"'+String(v).replaceAll('"','""')+'"' : String(v)).join(','))
    }
    const blob=new Blob([lines.join('\n')+'\n'],{type:'text/csv'})
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='users.csv'; a.click(); URL.revokeObjectURL(a.href)
  }

  function sortBy(key){ setSort(s=> ({ key, dir: s.key===key && s.dir==='asc' ? 'desc' : 'asc' })) }
  const arrow = (key)=> sort.key===key ? (sort.dir==='asc'?' ▲':' ▼') : ' ↕'
  const sortedRows = [...rows].sort((a,b)=>{
    const { key, dir } = sort
    let va = a[key]; let vb = b[key]
    if(typeof va==='string') va = va.toLowerCase(); if(typeof vb==='string') vb = vb.toLowerCase()
    const cmp = va<vb? -1 : (va>vb? 1 : 0)
    return dir==='asc'? cmp : -cmp
  })

  const staffRows = sortedRows.filter(u => ['STAFF', 'DANTE'].includes(u.role))
  const userRows = sortedRows.filter(u => u.role === 'USER')

  const tableHeader = (
    <thead><tr>
      <th onClick={()=>sortBy('email')} style={{cursor:'pointer'}}>Email{arrow('email')}</th>
      <th onClick={()=>sortBy('name')} style={{cursor:'pointer'}}>Name{arrow('name')}</th>
      <th onClick={()=>sortBy('role')} style={{cursor:'pointer'}}>Role{arrow('role')}</th>
      <th onClick={()=>sortBy('lab')} style={{cursor:'pointer'}}>Lab{arrow('lab')}</th>
      <th>Allowed</th>
      <th>Actions</th>
    </tr></thead>
  )

  const renderTableBody = (users) => (
    <tbody>
      {users.map(u => (
        <tr key={u.email}>
          <td>{u.email}</td>
          <td><input className="input" value={u.name||''} onChange={e=>updateRow(u.email,{ name: e.target.value })}/></td>
          <td>
            <select
              className="select"
              value={u.role}
              onChange={e=>{
                const nextRole = sanitizeRoleSelection(e.target.value)
                updateRow(u.email,{ role: nextRole })
              }}
              disabled={String(u.email||'').toLowerCase()==='<CHANGE:admin_email_here>'}
            >
              {roleChoices.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>
          </td>
          <td>
            <select className="select" value={u.lab||''} onChange={e=>updateRow(u.email,{ lab: e.target.value })}>
              <option value="">—</option>
              {labs.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
          </td>
          <td>
            <label style={{marginRight:6}}><input type="checkbox" checked={!!u.allowed_nmr300} onChange={e=>updateRow(u.email,{ allowed_nmr300: e.target.checked })}/> 300</label>
            <label style={{marginRight:6}}><input type="checkbox" checked={!!u.allowed_nmr400} onChange={e=>updateRow(u.email,{ allowed_nmr400: e.target.checked })}/> 400</label>
            <label><input type="checkbox" checked={!!u.allowed_nmr500} onChange={e=>updateRow(u.email,{ allowed_nmr500: e.target.checked })}/> 500</label>
          </td>
          <td>
            <button className="btn" onClick={()=>saveUser(u)}>Save</button>
            <button className="btn secondary" onClick={()=>delUser(u.email)}>Delete</button>
            {u.role==='USER' && (
              u.__blocked
                ? <button className="btn secondary" onClick={()=>unblockUser(u.email)} title="Unblock user">Unblock</button>
                : <button className="btn secondary" onClick={()=>blockUser(u.email)} title="Block user">Block</button>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  )

  return (
    <div>
      <h3>User management</h3>
      <p>{msg}</p>
      {includeRegistration && reg.length>0 && (
        <div className="card" style={{padding:12, marginBottom:12}}>
          <div style={{fontWeight:600, marginBottom:8}}>Registration requests</div>
          <table>
            <thead><tr><th>Email</th><th>Name</th><th>Lab</th><th>Actions</th></tr></thead>
            <tbody>
              {reg.map(r=> (
                <tr key={r.email}>
                  <td>{r.email}</td>
                  <td>{r.name||''}</td>
                  <td>{r.lab||''}</td>
                  <td>
                    <button className="btn" onClick={()=>{
                      setApprove({ email: r.email, lab: r.lab||'', role:'USER', allowed_nmr300:false, allowed_nmr400:false, allowed_nmr500:false })
                      setApproveOpen(true)
                    }}>Approve</button>
                    <button className="btn secondary" onClick={async()=>{
                      setMsg('Denying…')
                      const res = await fetch(`${API}/admin/registration_requests/deny`,{
                        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
                        body: JSON.stringify({ email: r.email })
                      })
                      const j=await res.json(); if(!res.ok){ setMsg(j.error||'ERROR'); return }
                      setMsg('Denied'); load()
                    }}>Deny</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{marginBottom:8}}>
        <button className="btn secondary" onClick={exportUsersCSV}>Export users CSV</button>
      </div>
      <form onSubmit={addUser} style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}}>
        <input className="input" placeholder="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
        <select
          className="select"
          value={form.role}
          onChange={e=>setForm(f=>({...f,role:sanitizeRoleSelection(e.target.value)}))}
        >
          {roleChoices.map(opt => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <select className="select" value={form.lab} onChange={e=>setForm({...form,lab:e.target.value})}>
          <option value="">-- choose lab --</option>
          {labs.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}
        </select>
        <input className="input" placeholder="passcode" type="password" value={form.passcode} onChange={e=>setForm({...form,passcode:e.target.value})}/>
        <button className="btn" type="submit">Add user</button>
      </form>

      <Collapsible title={`Staff & Dante (${staffRows.length})`} defaultOpen>
        <table>
          {tableHeader}
          {renderTableBody(staffRows)}
        </table>
      </Collapsible>

      <Collapsible title={`Users (${userRows.length})`} defaultOpen>
        <table>
          {tableHeader}
          {renderTableBody(userRows)}
        </table>
      </Collapsible>

      {includeRegistration && approveOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'grid',placeItems:'center',zIndex:1000}}>
          <div style={{width:520,background:'#fff',borderRadius:12,padding:16,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}}>
            <h3 style={{marginTop:0}}>Approve registration</h3>
            <form onSubmit={async (e)=>{
              e.preventDefault()
              if(approve.role==='DANTE' && !confirm('Grant DANTE role to this user?')) return
              setMsg('Approving…')
              const body = {
                email: approve.email,
                role: approve.role,
                lab: approve.lab||'',
                allowed_nmr300: !!approve.allowed_nmr300,
                allowed_nmr400: !!approve.allowed_nmr400,
                allowed_nmr500: !!approve.allowed_nmr500,
              }
              const res = await fetch(`${API}/admin/registration_requests/approve`,{
                method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
                body: JSON.stringify(body)
              })
              const j=await res.json(); if(!res.ok){ setMsg(j.error||'ERROR'); return }
              setApproveOpen(false)
              setMsg('Approved'); load()
            }} style={{display:'grid',gap:10}}>
              <div className="muted">Email: <b>{approve.email}</b></div>
              <label style={{display:'grid',gap:6}}>
                <span style={{fontSize:12,color:'var(--muted)'}}>Lab</span>
                <select className="select" value={approve.lab} onChange={e=>setApprove(a=>({...a,lab:e.target.value}))}>
                  <option value="">—</option>
                  {labs.map(l=> <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </label>
              <label style={{display:'grid',gap:6}}>
                <span style={{fontSize:12,color:'var(--muted)'}}>Role</span>
                <select
                  className="select"
                  value={approve.role}
                  onChange={e=>setApprove(a=>({...a,role:sanitizeRoleSelection(e.target.value)}))}
                >
                  {roleChoices.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend style={{fontSize:12,color:'var(--muted)',marginBottom:4}}>Allowed resources</legend>
                <label style={{marginRight:10}}>
                  <input type="checkbox" checked={!!approve.allowed_nmr300} onChange={e=>setApprove(a=>({...a,allowed_nmr300:e.target.checked}))}/> NMR300
                </label>
                <label style={{marginRight:10}}>
                  <input type="checkbox" checked={!!approve.allowed_nmr400} onChange={e=>setApprove(a=>({...a,allowed_nmr400:e.target.checked}))}/> NMR400
                </label>
                <label>
                  <input type="checkbox" checked={!!approve.allowed_nmr500} onChange={e=>setApprove(a=>({...a,allowed_nmr500:e.target.checked}))}/> NMR500
                </label>
              </fieldset>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button type="button" className="btn secondary" onClick={()=>setApproveOpen(false)}>Cancel</button>
                <button className="btn" type="submit">Approve</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Collapsible({ title, children, defaultOpen=false }){
  const [open,setOpen]=React.useState(defaultOpen)
  return (
    <div style={{marginTop:12}}>
      <div style={{cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center', padding:'8px 0'}} onClick={()=>setOpen(o=>!o)}>
        <h4 style={{margin:0}}>{title}</h4>
        <div style={{color:'var(--muted)'}}>{open?'▲':'▼'}</div>
      </div>
      {open && (
        <div style={{paddingTop:8}}>{children}</div>
      )}
    </div>
  )
}
