import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminClients({ token }){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  const [name,setName]=useState('')
  const [editing,setEditing]=useState(null) // {id,name,active}

  async function load(){
    try{
      const r=await fetch(`${API}/admin/clients`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR')
      setRows(Array.isArray(j)?j:[])
    }catch{ setRows([]); setMsg('Failed to load clients') }
  }
  useEffect(()=>{ load() },[])

  async function add(){
    const v = name.trim(); if(!v) return
    const r=await fetch(`${API}/admin/clients/save`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ name:v, active:true }) })
    const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR')
    setName(''); load()
  }
  async function saveOne(row){
    const r=await fetch(`${API}/admin/clients/save`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify(row) })
    const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR')
    setEditing(null); load()
  }
  async function del(id){
    if(!confirm('Delete this client?')) return
    const r=await fetch(`${API}/admin/clients/delete`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ id }) })
    const j=await r.json(); if(!r.ok) return setMsg(j.error||'ERROR')
    load()
  }

  return (
    <div>
      <h3>Clients</h3>
      <div className="muted">{msg}</div>
      <div style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Client name"/>
        <button onClick={add}>Add</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.map(r=> (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>
                {editing?.id===r.id ? (
                  <input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/>
                ) : r.name}
              </td>
              <td>
                {editing?.id===r.id ? (
                  <input type="checkbox" checked={!!editing.active} onChange={e=>setEditing({...editing,active:e.target.checked})}/>
                ) : (r.active?'Yes':'No')}
              </td>
              <td>
                {editing?.id===r.id ? (
                  <>
                    <button onClick={()=>saveOne(editing)}>Save</button>
                    <button onClick={()=>setEditing(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>setEditing(r)}>Edit</button>
                    <button onClick={()=>del(r.id)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

