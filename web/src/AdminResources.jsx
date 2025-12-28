import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminResources({token}){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')
  const [probeMap,setProbeMap]=useState({}) // { resource: [active probes] }

  async function load(){
    setMsg('Loading…')
    try{
      const r=await fetch(`${API}/admin/resources`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json()
      if(!r.ok){ setMsg(j.error||'Failed to load resources'); setRows([]); return }
      setRows(Array.isArray(j)?j:[]); setMsg('')
    }catch{ setRows([]); setMsg('Failed to load resources') }
  }
  useEffect(()=>{ load() },[])
  useEffect(()=>{
    async function loadProbes(){
      try{
        const r=await fetch(`${API}/admin/probes`,{ headers:{'Authorization':'Bearer '+token} })
        const j=await r.json()
        if(!r.ok) return setProbeMap({})
        const map={}
        for(const x of (Array.isArray(j)?j:[])){
          if(!x.active) continue
          if(!map[x.resource]) map[x.resource]=[]
          map[x.resource].push(x.probe)
        }
        Object.keys(map).forEach(k=> map[k].sort())
        setProbeMap(map)
      }catch{ setProbeMap({}) }
    }
    loadProbes()
  },[])

  function mutate(i,patch){ setRows(prev=> prev.map((r,idx)=> idx===i? {...r,...patch} : r )) }

  async function saveOne(r){
    setMsg(`Saving ${r.name}…`)
    const res = await fetch(`${API}/admin/resources/save`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({
        name:r.name, visible:!!r.visible, advance_days:Number(r.advance_days)||0,
        status:r.status||'OK', limitation_note:r.limitation_note||'',
        active_probe: (r.active_probe||'').trim()||null,
        default_probe: (r.default_probe||'').trim()||null,
        color_hex: (r.color_hex||'').trim()
      })
    })
    const j=await res.json(); if(!res.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Saved')
  }

  return (
    <div>
      <h3>Resource configuration</h3>
      <p>{msg}</p>
      <table>
        <thead><tr><th>Name</th><th>Visible</th><th>Advance days</th><th>Status</th><th>Note</th><th>Active probe</th><th>Default probe</th><th>Color</th><th></th></tr></thead>
        <tbody>
          {rows.map((r,i)=>
            <tr key={r.name}>
              <td>{r.name}</td>
              <td><input type="checkbox" checked={!!r.visible} onChange={e=>mutate(i,{visible:e.target.checked})}/></td>
              <td><input className="input" type="number" value={r.advance_days??0} onChange={e=>mutate(i,{advance_days:e.target.value})} style={{width:100}}/></td>
              <td>
                <select className="select" value={r.status||'OK'} onChange={e=>mutate(i,{status:e.target.value})} style={{borderColor: r.status==='OK' ? 'var(--c-teal-200)' : (r.status==='LIMITED' ? 'var(--c-amber)' : 'var(--c-oxblood)')}}>
                  <option value="OK">OK</option>
                  <option value="LIMITED">LIMITED</option>
                  <option value="DOWN">DOWN</option>
                </select>
              </td>
              <td><input className="input" value={r.limitation_note||''} onChange={e=>mutate(i,{limitation_note:e.target.value})} style={{minWidth:220}}/></td>
              <td>
                <select className="select" value={r.active_probe||''} onChange={e=>mutate(i,{active_probe:e.target.value})} style={{minWidth:160,width:160}}>
                  <option value="">—</option>
                  {(probeMap[r.name]||[]).map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              <td>
                <select className="select" value={r.default_probe||''} onChange={e=>mutate(i,{default_probe:e.target.value})} style={{minWidth:160,width:160}}>
                  <option value="">No default</option>
                  {(probeMap[r.name]||[]).map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              <td>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input className="input" placeholder="#RRGGBB" value={r.color_hex||''} onChange={e=>mutate(i,{color_hex:e.target.value})} style={{width:110}}/>
                  <div title={r.color_hex||''} style={{width:22,height:22,borderRadius:4,border:'1px solid var(--border)', background:(r.color_hex||'transparent')}}></div>
                </div>
              </td>
              <td><button className="btn" onClick={()=>saveOne(rows[i])}>Save</button></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
