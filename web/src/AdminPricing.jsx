import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminPricing({token}){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  const [form,setForm]=useState({resource:'',experiment:'',probe:'GLOBAL',rate_code:'STD',rate_per_hour_eur:'15',effective_from:''})
  const [editId,setEditId]=useState(null)
  const [editRow,setEditRow]=useState(null)
  const [resources,setResources]=useState([])
  const [experiments,setExperiments]=useState([])

  async function load(){
    try{
      const r=await fetch(`${API}/admin/pricing`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json()
      if(!r.ok){ setMsg(j.error||'Failed to load pricing'); setRows([]); return }
      setRows(Array.isArray(j)?j:[]); setMsg('')
    }catch{ setRows([]); setMsg('Failed to load pricing') }
  }
  useEffect(()=>{ load() },[])
  useEffect(()=>{
    fetch(`${API}/admin/resources`,{ headers:{'Authorization':'Bearer '+token} })
      .then(r=>r.json()).then(j=>{
        if(Array.isArray(j)){
          const names = j.map(x=>x.name)
          setResources(names)
          setForm(prev=>{
            if(prev.resource && names.includes(prev.resource)) return prev
            return { ...prev, resource: names[0] || '' }
          })
        }
      })
      .catch(()=>{})
  },[token])

  useEffect(()=>{
    fetch(`${API}/experiments`)
      .then(r=>r.json())
      .then(list=>{
        const codes = Array.isArray(list) ? list : []
        setExperiments(codes)
        setForm(prev=>{
          if(prev.experiment && codes.includes(prev.experiment)) return prev
          return { ...prev, experiment: codes[0] || '' }
        })
      })
      .catch(()=>{})
  },[token])

  async function resetDefaults(){
    setMsg('Resetting defaults…')
    const r=await fetch(`${API}/admin/pricing/reset_defaults`,{
      method:'POST', headers:{'Authorization':'Bearer '+token}
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg(`Defaults applied (${j.updated} rows)`); load()
  }

  async function upsert(){
    setMsg('Saving…')
    const body = {
      resource: form.resource,
      experiment: form.experiment,
      probe: form.probe || 'GLOBAL',
      rate_code: form.rate_code,
      rate_per_hour_eur: Number(form.rate_per_hour_eur),
      effective_from: form.effective_from // YYYY-MM-DD
    }
    const r=await fetch(`${API}/admin/pricing/upsert`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(body)
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Saved'); load()
  }

  async function del(id){
    if(!confirm('Delete price row?')) return
    const r=await fetch(`${API}/admin/pricing/delete`,{
      method:'DELETE',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({id})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    load()
  }

  return (
    <div>
      <h3>Pricing</h3>
      <p>{msg}</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}}>
        <select className="select" value={form.resource} onChange={e=>setForm({...form,resource:e.target.value})}>
          {resources.map(r=> <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="select" value={form.experiment} onChange={e=>setForm({...form,experiment:e.target.value})}>
          {experiments.map(code=> <option key={code} value={code}>{code}</option>)}
        </select>
        <input className="input" placeholder="rate code" value={form.rate_code} onChange={e=>setForm({...form,rate_code:e.target.value})}/>
        <input className="input" type="number" step="0.01" placeholder="€/h" value={form.rate_per_hour_eur} onChange={e=>setForm({...form,rate_per_hour_eur:e.target.value})}/>
        <input className="input" type="date" value={form.effective_from} onChange={e=>setForm({...form,effective_from:e.target.value})}/>
        <button className="btn" onClick={upsert}>Save/Upsert</button>
        <button className="btn secondary" onClick={resetDefaults}>Reset defaults</button>
      </div>

      <table>
        <thead><tr><th>ID</th><th>Res</th><th>Exp</th><th>Probe</th><th>Rate code</th><th>€/h</th><th>From</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.map(r=>{
            const editing = editId===r.id
            return (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.resource}</td>
                <td>{r.experiment}</td>
                <td>{r.probe || 'GLOBAL'}</td>
                <td>
                  {editing ? (
                    <input className="input" value={editRow.rate_code} onChange={e=>setEditRow({...editRow, rate_code:e.target.value})} />
                  ) : r.rate_code}
                </td>
                <td>
                  {editing ? (
                    <input className="input" type="number" step="0.01" value={editRow.rate_per_hour_eur}
                           onChange={e=>setEditRow({...editRow, rate_per_hour_eur:e.target.value})} />
                  ) : r.rate_per_hour_eur}
                </td>
                <td>
                  {editing ? (
                    <input className="input" type="date" value={String(editRow.effective_from).slice(0,10)}
                           onChange={e=>setEditRow({...editRow, effective_from:e.target.value})} />
                  ) : String(r.effective_from).slice(0,10)}
                </td>
                <td>
                  {editing ? (
                    <>
                      <button className="btn" onClick={async()=>{
                        setMsg('Saving…')
                        const body = {
                          resource: r.resource,
                          experiment: r.experiment,
                          probe: editRow.probe || r.probe || 'GLOBAL',
                          rate_code: editRow.rate_code,
                          rate_per_hour_eur: Number(editRow.rate_per_hour_eur),
                          effective_from: editRow.effective_from
                        }
                        const res = await fetch(`${API}/admin/pricing/upsert`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify(body) })
                        const j = await res.json(); if(!res.ok){ setMsg(j.error||'ERROR'); return }
                        setEditId(null); setEditRow(null); setMsg('Saved'); load()
                      }}>Save</button>
                      <button className="btn secondary" onClick={()=>{ setEditId(null); setEditRow(null) }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn" onClick={()=>{ setEditId(r.id); setEditRow({ probe: r.probe || 'GLOBAL', rate_code:r.rate_code, rate_per_hour_eur:r.rate_per_hour_eur, effective_from:String(r.effective_from).slice(0,10) }) }}>Edit</button>
                      <button className="btn secondary" onClick={()=>del(r.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            )})}
        </tbody>
      </table>
    </div>
  )
}
