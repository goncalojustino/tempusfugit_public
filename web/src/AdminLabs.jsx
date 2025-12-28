import React, { useEffect, useMemo, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminLabs({token}){
  const [rows,setRows]=useState([])
  const [name,setName]=useState('')
  const [msg,setMsg]=useState('')
  const [users,setUsers]=useState([])
  const [viewLab,setViewLab]=useState(null) // lab name to show users for
  const [editingId,setEditingId]=useState(null)
  const [editingName,setEditingName]=useState('')

  async function load(){
    try{
      const r=await fetch(`${API}/admin/labs`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json()
      if(!r.ok){ setMsg(j.error||'Failed to load labs'); setRows([]); return }
      setRows(Array.isArray(j)?j:[]); setMsg('')
    }catch{ setRows([]); setMsg('Failed to load labs') }
  }
  useEffect(()=>{ load(); ensureUsers() },[])

  async function save(){
    const r=await fetch(`${API}/admin/labs/save`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({name})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setName('')
    await load()
  }

  async function update(id, newName){
    const r=await fetch(`${API}/admin/labs/save`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({id, name:newName})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setEditingId(null)
    await load()
  }

  async function del(id){
    if(!confirm('Delete this lab?')) return
    const r=await fetch(`${API}/admin/labs/delete`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({id})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    await load()
  }

  async function ensureUsers(){
    if(users.length) return
    try{
      const r=await fetch(`${API}/admin/users`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json(); if(r.ok) setUsers(Array.isArray(j)?j:[])
    }catch{}
  }

  const usersByLab = useMemo(()=>{
    const m = new Map();
    for(const u of users){ const k = u.lab||''; if(!m.has(k)) m.set(k, []); m.get(k).push(u) }
    return m
  },[users])

  const [sort,setSort]=useState({ key:'name', dir:'asc' })
  function sortBy(key){ setSort(s=> ({ key, dir: s.key===key && s.dir==='asc' ? 'desc' : 'asc' })) }
  const arrow = (key)=> sort.key===key ? (sort.dir==='asc'?' ▲':' ▼') : ' ↕'
  const rowsWithMembers = rows.map(l=> ({...l, __members: (usersByLab.get(l.name)||[]).length }))
  const sorted = [...rowsWithMembers].sort((a,b)=>{
    const { key, dir } = sort
    let va = (key==='members'||key==='__members') ? a.__members : a[key]
    let vb = (key==='members'||key==='__members') ? b.__members : b[key]
    if(typeof va==='string') va = va.toLowerCase(); if(typeof vb==='string') vb = vb.toLowerCase()
    const cmp = va<vb? -1 : (va>vb? 1 : 0)
    return dir==='asc'? cmp : -cmp
  })

  function sanitizeCsvCell(value) {
    let s = String(value == null ? '' : value);
    // Prevent formula injection
    if (s.length > 0 && ['=', '+', '-', '@', '\t', '\r'].includes(s[0])) {
      s = "'" + s;
    }
    // Quote if it contains comma, double-quote, or newline
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function exportLabsCSV(){
    const header = ['id','name','members']
    const lines = [header.join(',')]
    for(const l of rows){
      const members = (usersByLab.get(l.name)||[]).length
      const vals = [l.id, l.name, members]
      lines.push(vals.map(sanitizeCsvCell).join(','))
    }
    const blob = new Blob([lines.join('\n')+'\n'], {type:'text/csv'})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'labs.csv'; a.click(); URL.revokeObjectURL(a.href)
  }

  function exportLabUsersCSV(labName){
    const list = (usersByLab.get(labName)||[])
    const header = ['email','name','role','lab','allowed_nmr300','allowed_nmr400','allowed_nmr500'];
    const lines = [header.join(',')];
    for(const u of list){
      const vals = [u.email, u.name, u.role, u.lab, !!u.allowed_nmr300, !!u.allowed_nmr400, !!u.allowed_nmr500];
      lines.push(vals.map(sanitizeCsvCell).join(','));
    }
    const blob = new Blob([lines.join('\n')+'\n'], {type:'text/csv'})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lab_${labName||'none'}_users.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <h3>Labs</h3>
      <p>{msg}</p>
      <div style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}>
        <input placeholder="new lab" value={name} onChange={e=>setName(e.target.value)}/>
        <button onClick={save}>Add</button>
        <button onClick={()=>{ ensureUsers(); exportLabsCSV() }}>Export labs CSV</button>
      </div>
      <table>
        <thead><tr>
          <th onClick={()=>sortBy('id')} style={{cursor:'pointer'}}>ID{arrow('id')}</th>
          <th onClick={()=>sortBy('name')} style={{cursor:'pointer'}}>Name{arrow('name')}</th>
          <th onClick={()=>sortBy('members')} style={{cursor:'pointer'}}>Members{arrow('members')}</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>
          {sorted.map(l=>{
            const members = l.__members
            return (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>
                  {editingId===l.id ? (
                    <input value={editingName} onChange={e=>setEditingName(e.target.value)} />
                  ) : (
                    <span>{l.name}</span>
                  )}
                </td>
                <td>{members}</td>
                <td>
                  <button onClick={()=>{ setViewLab(l.name); ensureUsers() }}>View users</button>
                  {editingId===l.id ? (
                    <>
                      <button onClick={()=>{ const v=editingName.trim(); if(v && v!==l.name) update(l.id, v); setEditingId(null); }}>Save</button>
                      <button onClick={()=>{ setEditingId(null) }}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={()=>{ setEditingId(l.id); setEditingName(l.name) }}>Edit</button>
                  )}
                  <button onClick={()=>del(l.id)}>Delete</button>
                  <button onClick={()=>{ ensureUsers(); exportLabUsersCSV(l.name) }}>Export users CSV</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {viewLab!=null && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'grid',placeItems:'center',zIndex:1000}} onClick={()=>setViewLab(null)}>
          <div style={{background:'#fff',padding:16,borderRadius:8,minWidth:480,maxHeight:'80vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
            <h4>Users in lab: {viewLab||'—'}</h4>
            <table>
              <thead><tr><th>Email</th><th>Name</th><th>Role</th></tr></thead>
              <tbody>
                {(usersByLab.get(viewLab)||[]).map(u=> (
                  <tr key={u.email}><td>{u.email}</td><td>{u.name||''}</td><td>{u.role||''}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button onClick={()=>{ exportLabUsersCSV(viewLab) }}>Export CSV</button>
              <button onClick={()=>setViewLab(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
