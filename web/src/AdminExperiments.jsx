import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminExperiments({token}){
  const [experiments,setExperiments]=useState([])
  const [overrides,setOverrides]=useState([])
  const [msg,setMsg]=useState('')
  const [form,setForm]=useState({code:'',name:'',requires_approval:false})
  const [ov,setOv]=useState({resource:'NMR300',code:'REGULAR',requires_approval:false})
  const [editCode,setEditCode]=useState(null)
  const [editRow,setEditRow]=useState({name:'',requires_approval:false})

  async function load(){
    setMsg('Loading…')
    try{
      const r=await fetch(`${API}/admin/experiments`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
      setExperiments(Array.isArray(j.experiments)?j.experiments:[])
      setOverrides(Array.isArray(j.resource_overrides)?j.resource_overrides:[])
      setMsg('')
    }catch{ setExperiments([]); setOverrides([]); setMsg('Failed to load experiments') }
  }
  useEffect(()=>{ load() },[])

  async function upsert(){
    setMsg('Saving…')
    const r=await fetch(`${API}/admin/experiments/upsert`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(form)
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Saved'); setForm({code:'',name:'',requires_approval:false}); load()
  }
  async function del(code){
    if(!confirm('Delete experiment?')) return
    const r=await fetch(`${API}/admin/experiments/delete`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({code})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    load()
  }

  async function upsertOv(){
    setMsg('Saving…')
    const r=await fetch(`${API}/admin/resource_experiments/upsert`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(ov)
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Saved'); load()
  }
  async function delOv(resource,code){
    if(!confirm('Delete override?')) return
    const r=await fetch(`${API}/admin/resource_experiments/delete`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({resource, code})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    load()
  }

  return (
    <div>
      <h3>Experiments</h3>
      <p>{msg}</p>
      <div style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}>
        <input placeholder="code" value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/>
        <input placeholder="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
        <label><input type="checkbox" checked={!!form.requires_approval} onChange={e=>setForm({...form,requires_approval:e.target.checked})}/> Requires approval</label>
        <button onClick={upsert}>Save/Upsert</button>
      </div>

      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Requires approval</th><th>Actions</th></tr></thead>
        <tbody>
          {experiments.map(e=>{
            const isEdit = editCode===e.code
            return (
              <tr key={e.code}>
                <td>{e.code}</td>
                <td>
                  {isEdit
                    ? <input className="input" value={editRow.name} onChange={ev=>setEditRow({...editRow, name: ev.target.value})} />
                    : e.name}
                </td>
                <td>
                  {isEdit
                    ? <input type="checkbox" checked={!!editRow.requires_approval} onChange={ev=>setEditRow({...editRow, requires_approval: ev.target.checked})} />
                    : String(e.requires_approval)}
                </td>
                <td>
                  {isEdit ? (
                    <>
                      <button onClick={async()=>{ setMsg('Saving…'); const r=await fetch(`${API}/admin/experiments/upsert`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ code:e.code, name:editRow.name, requires_approval: !!editRow.requires_approval }) }); const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return } setMsg('Saved'); setEditCode(null); load() }}>Save</button>
                      <button className="btn secondary" onClick={()=>{ setEditCode(null) }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={()=>{ setEditCode(e.code); setEditRow({ name:e.name, requires_approval:!!e.requires_approval }) }}>Edit</button>
                      <button className="btn secondary" onClick={()=>del(e.code)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            )})}
        </tbody>
      </table>

      <h3 style={{marginTop:24}}>Per-resource overrides</h3>
      <div style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}>
        <select value={ov.resource} onChange={e=>setOv({...ov,resource:e.target.value})}>
          <option>NMR300</option><option>NMR400</option><option>NMR500</option>
        </select>
        <select value={ov.code} onChange={e=>setOv({...ov,code:e.target.value})}>
          {experiments.map(e=> <option key={e.code} value={e.code}>{e.code}</option>)}
        </select>
        <label><input type="checkbox" checked={!!ov.requires_approval} onChange={e=>setOv({...ov,requires_approval:e.target.checked})}/> Requires approval</label>
        <button onClick={upsertOv}>Save/Upsert</button>
      </div>

      <table>
        <thead><tr><th>Resource</th><th>Experiment</th><th>Requires approval</th><th></th></tr></thead>
        <tbody>
          {overrides.map((r,i)=>
            <tr key={i}>
              <td>{r.resource}</td>
              <td>{r.code}</td>
              <td>{String(r.requires_approval)}</td>
              <td><button onClick={()=>delOv(r.resource,r.code)}>Delete</button></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
