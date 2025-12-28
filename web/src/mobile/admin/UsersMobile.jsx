import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function UsersMobile({ token }){
  const [rows,setRows]=useState([])
  const [labs,setLabs]=useState([])
  const [msg,setMsg]=useState('')
  const [form,setForm]=useState({email:'',role:'USER',lab:'',passcode:''})
  useEffect(()=>{ load() },[])
  async function load(){
    try{
      const [ru, rl, rb] = await Promise.all([
        fetch(`${API}/admin/users`,{ headers:{'Authorization':'Bearer '+token} }),
        fetch(`${API}/admin/labs`, { headers:{'Authorization':'Bearer '+token} }),
        fetch(`${API}/admin/users/blocked`, { headers:{'Authorization':'Bearer '+token} }),
      ])
      const [ju, jl, jblk] = await Promise.all([ru.json(), rl.json(), rb.json()])
      const blocked = new Set((Array.isArray(jblk)?jblk:[]).map(x=> String(x.email||'').toLowerCase()))
      const users = (Array.isArray(ju)?ju:[]).map(u=> ({...u, __blocked: blocked.has(String(u.email||'').toLowerCase()) }))
      setRows(users); setLabs(Array.isArray(jl)?jl:[]); setMsg('')
    }catch{ setMsg('Failed to load') }
  }
  async function addUser(e){ e.preventDefault(); setMsg('Adding…'); const r=await fetch(`${API}/admin/users/add`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify(form)}); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); setForm({email:'',role:'USER',lab:'',passcode:''}); load() }
  async function saveUser(u){ setMsg('Saving…'); const r=await fetch(`${API}/admin/users/update`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify(u)}); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); setMsg('Saved'); window.location.reload() }
  async function delUser(email){ if(!confirm(`Delete ${email}?`)) return; const r=await fetch(`${API}/admin/users/delete`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({email}) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); load() }
  async function blockUser(email){ const r=await fetch(`${API}/admin/users/block`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({email}) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); load() }
  async function unblockUser(email){ const r=await fetch(`${API}/admin/users/unblock`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({email}) }); const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR'); load() }

  const staffRows = rows.filter(u => ['STAFF', 'DANTE'].includes(u.role))
  const userRows = rows.filter(u => u.role === 'USER')

  return (
    <div>
      <Collapsible title={`Staff & Dante (${staffRows.length})`} defaultOpen>
        <ul style={{listStyle:'none',padding:0,margin:'8px 0',display:'grid',gap:8}}>
          {staffRows.map(u=> (
            <li key={u.email} className="card" style={{padding:12}}>
              <div style={{fontWeight:600, marginBottom:6}}>{u.email}</div>
              <div style={{display:'grid',gap:6}}>
                <input className="input" defaultValue={u.name||''} onChange={e=>u.name=e.target.value} placeholder="name"/>
                <select className="select" defaultValue={u.role} onChange={e=>u.role=e.target.value}><option>USER</option><option>STAFF</option><option>DANTE</option></select>
                <select className="select" defaultValue={u.lab||''} onChange={e=>u.lab=e.target.value}>
                  <option value="">—</option>
                  {labs.map(l=> <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
                <div>
                  <label style={{marginRight:8}}><input type="checkbox" defaultChecked={!!u.allowed_nmr300} onChange={e=>u.allowed_nmr300=e.target.checked}/> 300</label>
                  <label style={{marginRight:8}}><input type="checkbox" defaultChecked={!!u.allowed_nmr400} onChange={e=>u.allowed_nmr400=e.target.checked}/> 400</label>
                  <label><input type="checkbox" defaultChecked={!!u.allowed_nmr500} onChange={e=>u.allowed_nmr500=e.target.checked}/> 500</label>
                </div>
                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button className="btn" onClick={()=>saveUser(u)}>Save</button>
                  <button className="btn secondary" onClick={()=>delUser(u.email)}>Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Collapsible>

      <Collapsible title={`Users (${userRows.length})`} defaultOpen>
        <form onSubmit={addUser} className="card" style={{padding:12,display:'grid',gap:8, marginTop: 8}}>
          <div style={{fontWeight:600}}>Add user</div>
          <input className="input" placeholder="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
          <select className="select" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option>USER</option><option>STAFF</option><option>DANTE</option></select>
          <select className="select" value={form.lab} onChange={e=>setForm({...form,lab:e.target.value})}>
            <option value="">— choose lab —</option>
            {labs.map(l=> <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
          <input className="input" placeholder="passcode" type="password" value={form.passcode} onChange={e=>setForm({...form,passcode:e.target.value})}/>
          <button className="btn">Add</button>
          <div className="muted">{msg}</div>
        </form>
        <ul style={{listStyle:'none',padding:0,margin:'12px 0',display:'grid',gap:8}}>
          {userRows.map(u=> (
            <li key={u.email} className="card" style={{padding:12, background: u.__blocked ? '#fff1f2' : '#fff'}}>
              <div style={{fontWeight:600, marginBottom:6}}>{u.email}</div>
              <div style={{display:'grid',gap:6}}>
                <input className="input" defaultValue={u.name||''} onChange={e=>u.name=e.target.value} placeholder="name"/>
                <select className="select" defaultValue={u.role} onChange={e=>u.role=e.target.value}><option>USER</option><option>STAFF</option><option>DANTE</option></select>
                <select className="select" defaultValue={u.lab||''} onChange={e=>u.lab=e.target.value}>
                  <option value="">—</option>
                  {labs.map(l=> <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
                <div>
                  <label style={{marginRight:8}}><input type="checkbox" defaultChecked={!!u.allowed_nmr300} onChange={e=>u.allowed_nmr300=e.target.checked}/> 300</label>
                  <label style={{marginRight:8}}><input type="checkbox" defaultChecked={!!u.allowed_nmr400} onChange={e=>u.allowed_nmr400=e.target.checked}/> 400</label>
                  <label><input type="checkbox" defaultChecked={!!u.allowed_nmr500} onChange={e=>u.allowed_nmr500=e.target.checked}/> 500</label>
                </div>
                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button className="btn" onClick={()=>saveUser(u)}>Save</button>
                  <button className="btn secondary" onClick={()=>delUser(u.email)}>Delete</button>
                  {u.__blocked
                    ? <button className="btn secondary" onClick={()=>unblockUser(u.email)}>Unblock</button>
                    : <button className="btn secondary" onClick={()=>blockUser(u.email)}>Block</button>
                  }
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Collapsible>
    </div>
  )
}

function Collapsible({ title, children, defaultOpen=false }){
  const [open,setOpen]=React.useState(defaultOpen)
  return (
    <div style={{marginTop:12}}>
      <div style={{cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}} onClick={()=>setOpen(o=>!o)}>
        <div style={{fontWeight:600}}>{title}</div>
        <div style={{color:'var(--muted)'}}>{open?'▲':'▼'}</div>
      </div>
      {open && children}
    </div>
  )
}
