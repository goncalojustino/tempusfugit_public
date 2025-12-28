import React, { useEffect, useState } from 'react'
import TimePickerClock from './components/TimePickerClock.jsx'
import { lisbonDateTimeToInstant, formatLisbon } from './utils/timezone.js'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminTraining({ token }){
  const [rows,setRows]=useState([])
  const [resources,setResources]=useState(['NMR300','NMR400','NMR500'])
  const [msg,setMsg]=useState('')
  const [form,setForm]=useState({ resource:'NMR300', date:'', startTime:'', endTime:'', repeat:'once', reason:'' })

  async function load(){
    try{
      const r=await fetch(`${API}/admin/training`,{ headers:{'Authorization':'Bearer '+token} })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
      setRows(Array.isArray(j)?j:[]); setMsg('')
    }catch{ setRows([]); setMsg('Failed to load') }
  }
  useEffect(()=>{ load() },[])
  useEffect(()=>{
    fetch(`${API}/admin/resources`,{ headers:{'Authorization':'Bearer '+token} })
      .then(r=>r.json()).then(j=>{ if(Array.isArray(j)) setResources(j.map(x=>x.name)) })
      .catch(()=>{})
  },[token])

  const parseLisbonInstant = (dateStr, timeStr) => {
    const [year, month, day] = (dateStr || '').split('-').map(Number)
    const [hour = 0, minute = 0] = (timeStr || '').split(':').map(Number)
    if (![year, month, day, hour, minute].every(Number.isFinite)) return null
    return lisbonDateTimeToInstant({ year, month, day, hour, minute, second: 0 })
  }

  async function add(){
    setMsg('Adding…')
    if(!form.date || !form.startTime || !form.endTime){ setMsg('Pick date and times'); return }
    const startInstant = parseLisbonInstant(form.date, form.startTime)
    const endInstant = parseLisbonInstant(form.date, form.endTime)
    if(!startInstant || !endInstant){ setMsg('Invalid date or time'); return }
    const body = {
      resources: [form.resource],
      start: startInstant.toISOString(),
      end: endInstant.toISOString(),
      repeat: form.repeat,
      reason: form.reason
    }
    const r=await fetch(`${API}/admin/training/add`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(body)
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Added'); setForm({ resource: resources[0]||'NMR300', date:'', startTime:'', endTime:'', repeat:'once', reason:'' }); load()
  }

  async function del(id){
    if(!confirm('Delete training window?')) return
    const r=await fetch(`${API}/admin/training/delete`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({id})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    load()
  }

  return (
    <div>
      <h3>Training windows</h3>
      <p>{msg}</p>
      <p className="muted" style={{marginTop:-8}}>Pick a date, start time and end time. Choose one occurrence or repeat weekly.</p>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}>
        <label>Resource
          <select value={form.resource} onChange={e=>setForm({...form, resource:e.target.value})}>
            {resources.map(r=> <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>Date
          <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
        </label>
        <label>Start time
          <TimePickerClock value={form.startTime} onChange={val=>setForm({...form,startTime:val})} />
        </label>
        <label>End time
          <TimePickerClock value={form.endTime} onChange={val=>setForm({...form,endTime:val})} />
        </label>
        <label>Repeat
          <select value={form.repeat} onChange={e=>setForm({...form,repeat:e.target.value})}>
            <option value="once">One occurrence only</option>
            <option value="weekly">Repeat weekly</option>
            <option value="biweekly">Once every two weeks</option>
          </select>
        </label>
        <label>Reason
          <input value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} />
        </label>
        <button onClick={add} disabled={!form.resource || !form.date || !form.startTime || !form.endTime}>Add</button>
      </div>

      <table>
        <thead><tr><th>Resource</th><th>Start</th><th>End</th><th>Repeat</th><th>Reason</th><th></th></tr></thead>
        <tbody>
          {rows.map(r=> {
            const dStart = new Date(r.start_ts)
            const dEnd = new Date(r.end_ts)
            const weekday = formatLisbon(dStart, { weekday:'short' })
            const fmt = (d)=> formatLisbon(d, { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' })
            const durSec = Math.round((dEnd - dStart)/1000)
            const key = `${r.resource}|${String(dStart.getHours()).padStart(2,'0')}:${String(dStart.getMinutes()).padStart(2,'0')}|${durSec}`
            const counts = rows.reduce((n,x)=>{
              const xs=new Date(x.start_ts), xe=new Date(x.end_ts)
              const k = `${x.resource}|${String(xs.getHours()).padStart(2,'0')}:${String(xs.getMinutes()).padStart(2,'0')}|${Math.round((xe-xs)/1000)}`
              return n + (k===key ? 1 : 0)
            },0)
            const weekly = counts > 1
            return (
            <tr key={r.id}>
              <td>{r.resource}</td>
              <td>{weekday} {fmt(dStart)}</td>
              <td>{fmt(dEnd)}</td>
              <td>{weekly ? <span style={{fontSize:12,background:'#eef2ff',border:'1px solid #c7d2fe',padding:'2px 6px',borderRadius:999}}>weekly</span> : ''}</td>
              <td>{r.reason||''}</td>
              <td>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>del(r.id)}>Remove</button>
                  <button title="Stop this series from here" onClick={async()=>{
                    if(!confirm('Stop this series from this date onward?')) return;
                    const res = await fetch(`${API}/admin/training/stop`,{
                      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
                      body: JSON.stringify({id:r.id})
                    })
                    await res.json(); load()
                  }}>Stop</button>
                </div>
              </td>
            </tr>)
          })}
        </tbody>
      </table>
    </div>
  )
}
