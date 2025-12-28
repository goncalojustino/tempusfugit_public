import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminProbes({token}){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  const [form,setForm]=useState({resource:'NMR300',probe:'',active:true})

  async function load(){
    setMsg('Loading…')
    try{
      const r=await fetch(`${API}/admin/probes`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); setRows([]); return }
      setRows(Array.isArray(j)?j:[]); setMsg('')
    }catch{ setRows([]); setMsg('Failed to load probes') }
  }
  useEffect(()=>{ load() },[])

  async function upsert(){
    setMsg('Saving…')
    const r=await fetch(`${API}/admin/probes/upsert`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(form)
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Saved'); setForm({...form,probe:''}); load()
  }
  async function del(resource,probe){
    if(!confirm(`Remove ${probe} from ${resource}?`)) return
    const r=await fetch(`${API}/admin/probes/delete`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({resource, probe})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    load()
  }

  return (
    <div>
      <h3>Probes per resource</h3>
      <p>{msg}</p>
      <div style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}>
        <select value={form.resource} onChange={e=>setForm({...form,resource:e.target.value})}>
          <option>NMR300</option><option>NMR400</option><option>NMR500</option>
        </select>
        <input placeholder="probe name" value={form.probe} onChange={e=>setForm({...form,probe:e.target.value})}/>
        <label><input type="checkbox" checked={!!form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label>
        <button onClick={upsert}>Save/Upsert</button>
      </div>

      <table>
        <thead><tr><th>Resource</th><th>Probe</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {rows.map((r,i)=>
            <tr key={i}>
              <td>{r.resource}</td>
              <td>{r.probe}</td>
              <td>{String(r.active)}</td>
              <td><button onClick={()=>del(r.resource,r.probe)}>Delete</button></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

