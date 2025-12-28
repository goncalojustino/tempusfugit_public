import React, { useEffect, useRef, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

const COLOR_FIELDS = [
  { key: 'past_slot_color', label: 'Past slots', fallback: '#CBD5E1' },
  { key: 'slot_30m_color', label: '30 min slots', fallback: '#0A9396' },
  { key: 'slot_3h_color', label: '3 h slots', fallback: '#EE9B00' },
  { key: 'slot_12h_color', label: '12 h slots', fallback: '#CA6702' },
  { key: 'slot_24h_color', label: '24 h slots', fallback: '#BB3E03' },
]

function ColorInput({ value, onChange, fallback, title }){
  const pickerRef = useRef(null)
  const preview = (value && /^#[0-9a-fA-F]{6}$/.test(value)) ? value : fallback
  const handlePick = () => {
    if (pickerRef.current) {
      pickerRef.current.value = preview
      pickerRef.current.click()
    }
  }
  return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <input
        type="color"
        ref={pickerRef}
        onChange={e=>onChange(e.target.value.toUpperCase())}
        style={{position:'absolute',left:'-9999px',width:0,height:0,opacity:0}}
      />
      <input
        className="input"
        placeholder="#RRGGBB"
        value={value || ''}
        onChange={e=>onChange(e.target.value.toUpperCase())}
        style={{width:120,textTransform:'uppercase'}}
      />
      <button type="button" className="btn secondary" title="Pick color" style={{padding:'0 10px',height:34}}
        onClick={handlePick}>🎨</button>
      <div title={title} style={{width:28,height:28,borderRadius:6,border:'1px solid var(--border)',background:preview}}></div>
      <button type="button" className="btn secondary" onClick={()=>onChange('')} style={{padding:'0 10px',height:34}}>Clear</button>
    </div>
  )
}

export default function AdminSlotColors({ token }){
  const [rows,setRows]=useState([])
  const [msg,setMsg]=useState('')

  async function load(options={}){
    const silent = !!options.silent
    if(!silent) setMsg('Loading…')
    try{
      const r = await fetch(`${API}/admin/resources`,{ headers:{'Authorization':'Bearer '+token} })
      const j = await r.json()
      if(!r.ok){ setMsg(j.error||'Failed to load resources'); setRows([]); return false }
      setRows(Array.isArray(j)? j: [])
      if(!silent) setMsg('')
      return true
    }catch{
      setMsg('Failed to load resources')
      setRows([])
      return false
    }
  }
  useEffect(()=>{ load() },[token])

  const mutate = (idx, key, val)=>{
    setRows(prev=> prev.map((row,i)=> i===idx ? { ...row, [key]: val } : row ))
  }

  async function save(idx){
    const r = rows[idx]
    if(!r) return
    setMsg(`Saving ${r.name}…`)
    const payload = {
      name: r.name,
      visible: r.visible,
      advance_days: r.advance_days,
      status: r.status,
      limitation_note: r.limitation_note,
      active_probe: r.active_probe,
      default_probe: r.default_probe,
      color_hex: r.color_hex,
    }
    for(const field of COLOR_FIELDS){
      payload[field.key] = r[field.key] || ''
    }
    const res = await fetch(`${API}/admin/resources/save`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(payload)
    })
    const data = await res.json().catch(()=> ({}))
    if(!res.ok){ setMsg(data.error||'Failed to save colors'); return }
    const ok = await load({ silent:true })
    setMsg(ok ? 'Saved' : 'Saved, but failed to refresh list')
  }

  function resetToDefaults(idx){
    setRows(prev=> prev.map((row,i)=>{
      if(i!==idx) return row
      const patch = {}
      for(const field of COLOR_FIELDS){
        patch[field.key] = field.fallback
      }
      return { ...row, ...patch }
    }))
  }

  return (
    <div style={{marginTop:12}}>
      <h3>Grid slot colors</h3>
      <p className="muted">Define per-resource solid colors for the booking grid. Leave blank to fall back to the default palette.</p>
      <p>{msg}</p>
      <table>
        <thead>
          <tr>
            <th style={{minWidth:120}}>Resource</th>
            {COLOR_FIELDS.map(field=> <th key={field.key}>{field.label}</th>)}
            <th style={{width:160}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,idx)=>(
            <tr key={row.id||row.name}>
              <td>{row.name}</td>
              {COLOR_FIELDS.map(field=> (
                <td key={field.key}>
                  <ColorInput
                    value={row[field.key] || ''}
                    onChange={val=>mutate(idx, field.key, val)}
                    fallback={field.fallback}
                    title={`${row.name} · ${field.label}`}
                  />
                </td>
              ))}
              <td>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <button className="btn" onClick={()=>save(idx)}>Save</button>
                  <button className="btn secondary" onClick={()=>resetToDefaults(idx)}>Default palette</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
