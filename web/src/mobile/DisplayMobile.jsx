import React, { useEffect, useMemo, useState } from 'react'
import MobileNav from './MobileNav.jsx'
import {
  lisbonDateTimeToInstant,
  instantToLisbonDateTime,
  formatLisbon,
  getLisbonWeekdayIndex,
  shiftLisbonDateParts,
} from '../utils/timezone.js'
const API = import.meta.env.VITE_API_URL || '/api'

const fmtTime = d => formatLisbon(d instanceof Date ? d : new Date(d), { hour:'2-digit', minute:'2-digit', hourCycle:'h23' })

const buildSlots = (resourceName, dayParts) => {
  const list = []
  const addSlot = (start, end, label) => list.push({ start, end, label })
  const pushSeries = (h1,m1,h2,m2,label,stepMinutes)=>{
    let cur = lisbonDateTimeToInstant({ ...dayParts, hour:h1, minute:m1, second:0 })
    let limit = lisbonDateTimeToInstant({ ...dayParts, hour:h2, minute:m2, second:0 })
    if(h2 < h1 || (h2===h1 && m2<m1)){
      const next = shiftLisbonDateParts(dayParts,1)
      limit = lisbonDateTimeToInstant({ ...next, hour:h2, minute:m2, second:0 })
    }
    while(cur < limit){
      const slotEnd = new Date(cur.getTime() + stepMinutes * 60000)
      addSlot(cur, slotEnd, label)
      cur = slotEnd
    }
  }
  const dow = getLisbonWeekdayIndex(lisbonDateTimeToInstant({ ...dayParts, hour:0, minute:0, second:0 }))
  if(dow===6 || dow===0){
    const start = lisbonDateTimeToInstant({ ...dayParts, hour:8, minute:0, second:0 })
    const next = shiftLisbonDateParts(dayParts,1)
    const end = lisbonDateTimeToInstant({ ...next, hour:8, minute:0, second:0 })
    addSlot(start,end,'24h')
    return list
  }
  if(resourceName==='NMR300'){
    pushSeries(8,0,14,0,'30m',30)
    pushSeries(14,0,20,0,'3h',180)
    const start = lisbonDateTimeToInstant({ ...dayParts, hour:20, minute:0, second:0 })
    const next = shiftLisbonDateParts(dayParts,1)
    const end = lisbonDateTimeToInstant({ ...next, hour:8, minute:0, second:0 })
    addSlot(start,end,'12h')
  } else if(resourceName==='NMR400'){
    pushSeries(8,0,11,0,'3h',180)
    pushSeries(11,0,14,0,'30m',30)
    pushSeries(14,0,20,0,'3h',180)
    const start = lisbonDateTimeToInstant({ ...dayParts, hour:20, minute:0, second:0 })
    const next = shiftLisbonDateParts(dayParts,1)
    const end = lisbonDateTimeToInstant({ ...next, hour:8, minute:0, second:0 })
    addSlot(start,end,'12h')
  } else if(resourceName==='NMR500'){
    pushSeries(8,0,20,0,'3h',180)
    const start = lisbonDateTimeToInstant({ ...dayParts, hour:20, minute:0, second:0 })
    const next = shiftLisbonDateParts(dayParts,1)
    const end = lisbonDateTimeToInstant({ ...next, hour:8, minute:0, second:0 })
    addSlot(start,end,'12h')
  }
  return list
}

export default function DisplayMobile(){
  const [resources,setResources]=useState([])
  const [reservations,setReservations]=useState({})
  const [date,setDate]=useState(()=>{
    const now=instantToLisbonDateTime(new Date());
    return { year:now.year, month:now.month, day:now.day }
  })
  const [msg,setMsg]=useState('')

  const dayLabel = useMemo(()=>{
    const d = lisbonDateTimeToInstant({ ...date, hour:0, minute:0, second:0 })
    return formatLisbon(d,{ weekday:'short', day:'2-digit', month:'2-digit'})
  },[date])

  useEffect(()=>{
    fetch(`${API}/resources`).then(r=>r.json()).then(j=> {
      if(Array.isArray(j)) setResources(j.filter(r=>r.visible))
    }).catch(()=> setResources([]))
  },[])

  useEffect(()=>{
    const load = async ()=>{
      try{
        const dayStart = lisbonDateTimeToInstant({ ...date, hour:8, minute:0, second:0 })
        const nextDay = shiftLisbonDateParts(date,1)
        const dayEnd = lisbonDateTimeToInstant({ ...nextDay, hour:8, minute:0, second:0 })
        const s = dayStart.toISOString()
        const e = dayEnd.toISOString()
        const promises = resources.map(r =>
          fetch(`${API}/reservations/range?resource=${encodeURIComponent(r.name)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
            .then(async resp => resp.ok ? resp.json() : [])
        )
        const data = await Promise.all(promises)
        const byRes = {}
        resources.forEach((res,idx)=>{
          byRes[res.name] = Array.isArray(data[idx]) ? data[idx] : []
        })
        setReservations(byRes)
        setMsg('')
      }catch(_){ setMsg('Failed to load current usage') }
    }
    if(resources.length) load()
  },[resources, date])

  const bookSlot = (resourceName, slot) => {
    const startParts = instantToLisbonDateTime(slot.start)
    const iso = lisbonDateTimeToInstant(startParts).toISOString()
    const url = `/mobile/grid?resource=${encodeURIComponent(resourceName)}&day=${date.year}-${String(date.month).padStart(2,'0')}-${String(date.day).padStart(2,'0')}&start=${encodeURIComponent(iso)}`
    location.assign(url)
  }

  const slotsForResource = (resourceName)=>{
    const dayStart = lisbonDateTimeToInstant({ ...date, hour:0, minute:0, second:0 })
    const dayParts = instantToLisbonDateTime(dayStart)
    const slots = buildSlots(resourceName, dayParts)
    const busyList = reservations[resourceName] || []
    return slots.map(slot => {
      const occupied = busyList.find(r => new Date(r.start_ts) < slot.end && new Date(r.end_ts) > slot.start)
      return { slot, occupied }
    })
  }

  const shiftDay = (delta)=>{
    const target = shiftLisbonDateParts(date, delta)
    setDate(target)
  }

  return (
    <div>
      <MobileNav title="Current usage" role={null} onSwitchDesktop={()=> location.assign('/display')}/>
      <div className="container">
        <div className="card" style={{padding:12,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <button className="btn secondary" onClick={()=>shiftDay(-1)}>Prev</button>
          <div style={{fontWeight:700}}>{dayLabel}</div>
          <button className="btn secondary" onClick={()=>shiftDay(1)}>Next</button>
        </div>
        <p className="muted">{msg}</p>
        {resources.map(resource => (
          <div key={resource.name} className="card" style={{padding:12, marginBottom:12}}>
            <h3 style={{marginTop:0}}>{resource.name}</h3>
            <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
              {slotsForResource(resource.name).map(({slot, occupied}, idx)=>(
                <li key={idx} className={`slot-card ${occupied ? (occupied.status==='PENDING'?'pending':'booked') : 'available'}`}
                    onClick={()=> !occupied && bookSlot(resource.name, slot)}
                    style={{cursor: occupied?'default':'pointer'}}>
                  <div className="slot-time">{fmtTime(slot.start)} → {fmtTime(slot.end)} · {slot.label}</div>
                  <div className="slot-meta" style={{marginTop:4}}>
                    {occupied ? (
                      <>
                        <div>{occupied.user_name || occupied.user_email} · ID {occupied.id} {(occupied.status==='PENDING'||occupied.status==='CANCEL_PENDING')?'· Pending':''}</div>
                        {occupied.bill_to_type === 'CLIENT' ? (
                          <div>Client ID: {occupied.bill_to_client_id || '—'}{occupied.client_name ? ` · ${occupied.client_name}` : ''}</div>
                        ) : null}
                        <div>Exp: {occupied.experiment} · Probe: {occupied.probe}</div>
                      </>
                    ) : 'Tap to book'}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
