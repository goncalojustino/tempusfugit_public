import React, { useEffect, useState } from 'react'
import TimePickerClock from '../../components/TimePickerClock.jsx'
import { lisbonDateTimeToInstant, formatLisbon } from '../../utils/timezone.js'
const API = import.meta.env.VITE_API_URL || '/api'

export default function TrainingMobile({ token }){
  const [rows,setRows]=useState([])
  const [form,setForm]=useState({ resources:[], date:'', startTime:'', endTime:'', repeat:'once', reason:'' })
  useEffect(()=>{ load() },[])
  async function load(){ try{ const r=await fetch(`${API}/admin/training`,{ headers:{'Authorization':'Bearer '+token} }); const j=await r.json(); setRows(Array.isArray(j)?j:[]) }catch{ setRows([]) } }
  const parseLisbonInstant = (dateStr, timeStr) => {
    const [year, month, day] = (dateStr || '').split('-').map(Number)
    const [hour = 0, minute = 0] = (timeStr || '').split(':').map(Number)
    if (![year, month, day, hour, minute].every(Number.isFinite)) return null
    return lisbonDateTimeToInstant({ year, month, day, hour, minute, second: 0 })
  }
  async function add(){
    const startInstant = parseLisbonInstant(form.date, form.startTime)
    const endInstant = parseLisbonInstant(form.date, form.endTime)
    if(!startInstant || !endInstant){ alert('Invalid date or time'); return }
    const b={
      resources: form.resources,
      start: startInstant.toISOString(),
      end: endInstant.toISOString(),
      repeat: form.repeat,
      reason: form.reason
    }
    const r=await fetch(`${API}/admin/training/add`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify(b) })
    const j=await r.json(); if(!r.ok) return alert(j.error||'ERROR'); setForm({ resources:[], date:'', startTime:'', endTime:'', repeat:'once', reason:'' }); load() }
  async function del(id){ if(!confirm('Delete training window?')) return; await fetch(`${API}/admin/training/delete`,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({id}) }); load() }
  return (
    <div>
      <div className="card" style={{padding:12,display:'grid',gap:8,marginBottom:12}}>
        <div style={{fontWeight:600}}>Add training</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <select multiple className="select" value={form.resources} onChange={e=>setForm({...form,resources:[...e.target.selectedOptions].map(o=>o.value)})}>
            <option>NMR300</option><option>NMR400</option><option>NMR500</option>
          </select>
          <input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          <TimePickerClock value={form.startTime} onChange={val=>setForm({...form,startTime:val})} />
          <TimePickerClock value={form.endTime} onChange={val=>setForm({...form,endTime:val})} />
          <select className="select" value={form.repeat} onChange={e=>setForm({...form,repeat:e.target.value})}>
            <option value="once">One occurrence only</option>
            <option value="weekly">Repeat weekly</option>
            <option value="biweekly">Once every two weeks</option>
          </select>
        </div>
        <input className="input" placeholder="reason" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/>
        <button className="btn" onClick={add} disabled={!form.resources.length||!form.date||!form.startTime||!form.endTime}>Add</button>
      </div>
      <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
        {rows.map(r=> (
          <li key={r.id} className="card" style={{padding:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <strong>{r.resource}</strong> · {formatLisbon(new Date(r.start_ts), { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' })}
              {' '}→{' '}
              {formatLisbon(new Date(r.end_ts), { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' })}
              {' '}· {r.reason||''}
            </div>
            <button className="btn secondary" onClick={()=>del(r.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
