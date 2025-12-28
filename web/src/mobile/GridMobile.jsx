import React, { useEffect, useMemo, useState, useCallback } from 'react'
import MobileNav from './MobileNav.jsx'
import {
  lisbonDateTimeToInstant,
  instantToLisbonDateTime,
  shiftLisbonDateParts,
  formatLisbon,
  getLisbonWeekdayIndex,
} from '../utils/timezone.js'
const API = import.meta.env.VITE_API_URL || '/api'

const DEFAULT_SLOT_COLORS = {
  past: '#CBD5E1',
  '30m': '#0A9396',
  '3h': '#EE9B00',
  '12h': '#CA6702',
  '24h': '#BB3E03',
}
const PENDING_SHADE = '#FDE68A'

const STATUS_COLORS = {
  OK: '#047857',
  LIMITED: '#b45309',
  DOWN: '#b91c1c',
}

const normalizeColor = (value)=>{
  const v = String(value||'').trim()
  return /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : ''
}

const pad = (n)=> String(n).padStart(2,'0')
const partsToDateInput = ({ year, month, day })=> `${year}-${pad(month)}-${pad(day)}`
const fmtTime = (d)=> formatLisbon(d instanceof Date ? d : new Date(d), { hour:'2-digit', minute:'2-digit', hourCycle:'h23' })

export default function GridMobile({ token, role, email, onLogout }){
  const [resource,setResource]=useState('NMR300')
  const [date,setDate]=useState(()=>{
    const nowParts = instantToLisbonDateTime(new Date())
    return partsToDateInput({ year: nowParts.year, month: nowParts.month, day: nowParts.day })
  })
  const [experiments,setExperiments]=useState(['REGULAR','VT'])
  const [probes,setProbes]=useState([])
  const [selExp,setSelExp]=useState('REGULAR')
  const [selProbe,setSelProbe]=useState('')
  const [resInfo,setResInfo]=useState({
    active_probe:null,
    default_probe:null,
    color_hex:'',
    status:'',
    limitation_note:'',
    past_slot_color:'',
    slot_30m_color:'',
    slot_3h_color:'',
    slot_12h_color:'',
    slot_24h_color:'',
  })
  // Billing (STAFF/DANTE only)
  const [billTo,setBillTo]=useState('LAB') // 'LAB' | 'CLIENT'
  const [clients,setClients]=useState([])
  const [selClient,setSelClient]=useState('') // id as string
  const [totalPrice,setTotalPrice]=useState('')
  const [busy,setBusy]=useState([])
  const [msg,setMsg]=useState('')
  const [tzNotice,setTzNotice]=useState('')
  const [maintenance,setMaintenance]=useState([])
  const [training,setTraining]=useState([])

  const busyRanges = useMemo(()=> busy.map(item => ({ ...item, startInstant: new Date(item.start_ts), endInstant: new Date(item.end_ts) })), [busy])

  const setDateRelativeToToday = useCallback((delta)=>{
    const todayParts = instantToLisbonDateTime(new Date())
    const base = { year: todayParts.year, month: todayParts.month, day: todayParts.day }
    const target = shiftLisbonDateParts(base, delta)
    setDate(partsToDateInput(target))
  },[])

  useEffect(()=>{ localStorage.setItem('tf_view','mobile') },[])
  useEffect(()=>{
    if(typeof window === 'undefined') return
    try{
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      if(resolved && resolved !== 'Europe/Lisbon'){
        setTzNotice(`All bookings are handled in Lisbon time. Your device reports ${resolved}. We will convert times automatically.`)
        const flagKey = `tf_tz_reported_${resolved}`
        if(token && !localStorage.getItem(flagKey)){
          localStorage.setItem(flagKey, String(Date.now()))
          const payload = {
            tz_name: resolved,
            offset_minutes: -new Date().getTimezoneOffset(),
            user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : ''
          }
          fetch(`${API}/report/timezone-mismatch`,{
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
          }).catch(()=>{})
        }
      } else {
        setTzNotice('')
      }
    }catch(_){ setTzNotice('') }
  },[token])
  useEffect(()=>{
    fetch(`${API}/experiments`).then(r=>r.json()).then(j=>{
      if(Array.isArray(j) && j.length) {
        const full = j.map(x => String(x.code || x))
        setExperiments(full)
        if(full.includes('REGULAR')) setSelExp('REGULAR')
      }
    }).catch(()=>{})
  },[])
  useEffect(()=>{ setSelProbe(''); setBillTo('LAB'); setSelClient(''); setTotalPrice('') },[resource])
  useEffect(()=>{
    if(typeof window === 'undefined') return
    try{
      const params = new URLSearchParams(location.search)
      const res = params.get('resource')
      const day = params.get('day')
      if(res) setResource(res)
      if(day) setDate(day)
    }catch(_){ }
  },[])
  useEffect(()=>{ fetch(`${API}/resource-probes?resource=${encodeURIComponent(resource)}`).then(r=>r.json()).then(j=> Array.isArray(j)&&setProbes(j)).catch(()=>{}) },[resource])
  useEffect(()=>{ fetch(`${API}/resource-info?resource=${encodeURIComponent(resource)}`)
    .then(r=>r.json())
    .then(j=> setResInfo({
      active_probe:j?.active_probe||null,
      default_probe:j?.default_probe||null,
      color_hex: j?.color_hex||'',
      status: j?.status||'',
      limitation_note: j?.limitation_note||'',
      past_slot_color: j?.past_slot_color||'',
      slot_30m_color: j?.slot_30m_color||'',
      slot_3h_color: j?.slot_3h_color||'',
      slot_12h_color: j?.slot_12h_color||'',
      slot_24h_color: j?.slot_24h_color||'',
    })).catch(()=> setResInfo({
      active_probe:null,
      default_probe:null,
      color_hex:'',
      status:'',
      limitation_note:'',
      past_slot_color:'',
      slot_30m_color:'',
      slot_3h_color:'',
      slot_12h_color:'',
      slot_24h_color:'',
    })) },[resource])
  // Clients list for STAFF/DANTE
  useEffect(()=>{
    if(!['STAFF','DANTE'].includes(role)) return
    fetch(`${API}/clients`,{ headers:{ 'Authorization': 'Bearer ' + token } })
      .then(r=> r.ok? r.json():[])
      .then(j=> setClients(Array.isArray(j)? j: []))
      .catch(()=> setClients([]))
  },[role, token])
  useEffect(()=>{
    const def = (resInfo?.default_probe||'')
    if(def && probes.includes(def)) setSelProbe(def)
    else setSelProbe('')
  },[probes,resInfo])

  const selectedDayParts = useMemo(()=>{
    const parts = (date || '').split('-').map(Number)
    if(parts.length !== 3) return null
    const [year, month, day] = parts
    if (![year, month, day].every(Number.isFinite)) return null
    return { year, month, day }
  },[date])

  const dayMidnight = useMemo(()=> selectedDayParts ? lisbonDateTimeToInstant({ ...selectedDayParts, hour:0, minute:0, second:0 }) : null, [selectedDayParts])
  const dayStart = useMemo(()=> selectedDayParts ? lisbonDateTimeToInstant({ ...selectedDayParts, hour:8, minute:0, second:0 }) : null, [selectedDayParts])
  const dayEnd = useMemo(()=>{
    if(!selectedDayParts) return null
    const nextDay = shiftLisbonDateParts(selectedDayParts, 1)
    return lisbonDateTimeToInstant({ ...nextDay, hour:8, minute:0, second:0 })
  },[selectedDayParts])

  useEffect(()=>{
    if(!dayStart || !dayEnd) return
    const s = dayStart.toISOString()
    const e = dayEnd.toISOString()
    fetch(`${API}/reservations/range?resource=${encodeURIComponent(resource)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      .then(async r=> r.ok? r.json():[]).then(j=> setBusy(Array.isArray(j)?j:[])).catch(()=> setBusy([]))
    fetch(`${API}/maintenance?resource=${encodeURIComponent(resource)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      .then(async r=> r.ok? r.json():[])
      .then(j=> {
        if(Array.isArray(j)) setMaintenance(j.map(item => ({ ...item, start:new Date(item.start_ts), end:new Date(item.end_ts) })))
        else setMaintenance([])
      }).catch(()=> setMaintenance([]))
    fetch(`${API}/training?resource=${encodeURIComponent(resource)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      .then(async r=> r.ok? r.json():[])
      .then(j=> {
        if(Array.isArray(j)) setTraining(j.map(item => ({ ...item, start:new Date(item.start_ts), end:new Date(item.end_ts) })))
        else setTraining([])
      }).catch(()=> setTraining([]))
  },[resource, dayStart, dayEnd])

  const slots = useMemo(()=>{
    if(!dayMidnight) return []
    const list=[]
    const dow = getLisbonWeekdayIndex(dayMidnight)
    const dayParts = instantToLisbonDateTime(dayMidnight)

    const addSlot = (start, end, label) => list.push({ s: start, e: end, label })

    const pushSeries = (h1, m1, h2, m2, label, stepMinutes) => {
      let cursor = lisbonDateTimeToInstant({ ...dayParts, hour: h1, minute: m1, second: 0 })
      let limit = lisbonDateTimeToInstant({ ...dayParts, hour: h2, minute: m2, second: 0 })
      if (h2 < h1 || (h2 === h1 && m2 < m1)){
        const nextDay = shiftLisbonDateParts(dayParts, 1)
        limit = lisbonDateTimeToInstant({ ...nextDay, hour: h2, minute: m2, second: 0 })
      }
      while (cursor < limit){
        const slotEnd = new Date(cursor.getTime() + stepMinutes * 60000)
        addSlot(cursor, slotEnd, label)
        cursor = slotEnd
      }
    }

    if(dow === 6 || dow === 0){
      const start = lisbonDateTimeToInstant({ ...dayParts, hour:8, minute:0, second:0 })
      const nextDay = shiftLisbonDateParts(dayParts, 1)
      const end = lisbonDateTimeToInstant({ ...nextDay, hour:8, minute:0, second:0 })
      addSlot(start, end, '24h')
      return list
    }

    if(resource==='NMR300'){
      pushSeries(8,0,14,0,'30m',30)
      pushSeries(14,0,20,0,'3h',180)
      const start = lisbonDateTimeToInstant({ ...dayParts, hour:20, minute:0, second:0 })
      const nextDay = shiftLisbonDateParts(dayParts, 1)
      const end = lisbonDateTimeToInstant({ ...nextDay, hour:8, minute:0, second:0 })
      addSlot(start, end, '12h')
    } else if(resource==='NMR400'){
      pushSeries(8,0,11,0,'3h',180)
      pushSeries(11,0,14,0,'30m',30)
      pushSeries(14,0,20,0,'3h',180)
      const start = lisbonDateTimeToInstant({ ...dayParts, hour:20, minute:0, second:0 })
      const nextDay = shiftLisbonDateParts(dayParts, 1)
      const end = lisbonDateTimeToInstant({ ...nextDay, hour:8, minute:0, second:0 })
      addSlot(start, end, '12h')
    } else if(resource==='NMR500'){
      pushSeries(8,0,20,0,'3h',180)
      const start = lisbonDateTimeToInstant({ ...dayParts, hour:20, minute:0, second:0 })
      const nextDay = shiftLisbonDateParts(dayParts, 1)
      const end = lisbonDateTimeToInstant({ ...nextDay, hour:8, minute:0, second:0 })
      addSlot(start, end, '12h')
    }
    return list
  },[resource, dayMidnight])

  function occupied(slot){
    return busyRanges.find(b=> b.startInstant < slot.e && b.endInstant > slot.s)
  }

  const blockingRanges = useMemo(()=>{
    const ensureValid = entry => entry && entry.start instanceof Date && entry.end instanceof Date && !Number.isNaN(entry.start.getTime()) && !Number.isNaN(entry.end.getTime())
    const mapList = (list,type)=> list.filter(ensureValid).map(item=> ({ ...item, type, label: type==='training' ? 'Training' : 'Maintenance' }))
    return [
      ...mapList(maintenance,'maintenance'),
      ...mapList(training,'training')
    ]
  },[maintenance, training])

  const blockingOverlap = useCallback((slot)=> blockingRanges.find(block => slot.s < block.end && block.start < slot.e), [blockingRanges])

  const slotColorMap = useMemo(()=>({
    past: normalizeColor(resInfo.past_slot_color),
    '30m': normalizeColor(resInfo.slot_30m_color),
    '3h': normalizeColor(resInfo.slot_3h_color),
    '12h': normalizeColor(resInfo.slot_12h_color),
    '24h': normalizeColor(resInfo.slot_24h_color),
  }),[resInfo])

  const slotColorFor = useCallback((label)=>{
    if(label==='past') return slotColorMap.past || DEFAULT_SLOT_COLORS.past
    return slotColorMap[label] || DEFAULT_SLOT_COLORS[label] || DEFAULT_SLOT_COLORS.past
  },[slotColorMap])

  const statusKey = (resInfo.status || '').toUpperCase()
  const statusColor = STATUS_COLORS[statusKey] || '#4b5563'
  const resourceStatusLines = useMemo(()=>{
    const lines = []
    lines.push(`Status: ${resInfo.status ? resInfo.status : 'Unknown'}`)
    if(resInfo.limitation_note) lines.push(resInfo.limitation_note)
    if(resInfo.default_probe) lines.push(`Default probe: ${resInfo.default_probe}`)
    if(resInfo.active_probe) lines.push(`Active probe: ${resInfo.active_probe}`)
    return lines
  },[resInfo.status, resInfo.limitation_note, resInfo.default_probe, resInfo.active_probe])

  async function confirmBook(slot){
    try{
      const block = blockingOverlap(slot)
      if(block){
        alert(`${block.label || 'Blocked'} window. ${block.reason ? block.reason : ''}`.trim())
        return
      }
      const startParts = instantToLisbonDateTime(slot.s)
      const endParts = instantToLisbonDateTime(slot.e)
      const startInstant = lisbonDateTimeToInstant(startParts)
      const endInstant = lisbonDateTimeToInstant(endParts)
      const r = await fetch(`${API}/reservations/create`,{
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({ email, resource, start: startInstant.toISOString(), end: endInstant.toISOString(), experiment: selExp, probe: selProbe, label: slot.label,
          ...( ['STAFF','DANTE'].includes(role) && billTo==='CLIENT' ? {
            bill_to_type:'CLIENT',
            bill_to_client_id: selClient ? Number(selClient) : null,
            total_price_eur: (totalPrice || totalPrice===0) ? Number(totalPrice) : 0
          } : {} )
        })
      })
      const j=await r.json(); if(!r.ok) throw new Error(j.error||'FAILED')
      alert(j.status==='PENDING' ? 'Booking requested (pending approval)' : 'Booking created')
      if(!dayStart || !dayEnd) return
      const s = dayStart.toISOString(), e = dayEnd.toISOString()
      const rr = await fetch(`${API}/reservations/range?resource=${encodeURIComponent(resource)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      setBusy(await rr.json())
    }catch(e){ alert(String(e.message||e)) }
  }

  return (
    <div>
      <MobileNav title="Book" role={role} onSwitchDesktop={()=> location.assign('/grid')}/>
      <div style={{background: (resInfo.color_hex && resInfo.color_hex.trim()) ? resInfo.color_hex.trim() : 'var(--bg)', transition:'background 120ms linear'}}>
        <div className="container" style={{paddingTop:12}}>
        <div className="card" style={{marginBottom:12, borderColor:statusColor, background:statusColor, color:'#fff'}}>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {resourceStatusLines.map((line, idx)=> (
              <div key={idx} style={{fontWeight:idx===0?700:500,opacity: idx===0?1:0.9}}>{line}</div>
            ))}
            {!resourceStatusLines.length && (
              <div>Status information unavailable</div>
            )}
            <div style={{fontWeight:800,fontSize:28,textTransform:'uppercase',marginTop:8}}>{resource}</div>
          </div>
        </div>
        {tzNotice && (
          <div style={{marginBottom:12,padding:'10px 12px',border:'1px solid #fcd34d',background:'#fffbeb',borderRadius:10,color:'#92400e',fontSize:14}}>
            {tzNotice}
          </div>
        )}

        <div className="card" style={{padding:12, marginBottom:12, display:'grid', gap:8}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <select className="select" value={resource} onChange={e=>setResource(e.target.value)}>
              <option>NMR300</option><option>NMR400</option><option>NMR500</option>
            </select>
            <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
            <button className="btn secondary" onClick={()=> setDateRelativeToToday(0)}>Today</button>
            <button className="btn secondary" onClick={()=> setDateRelativeToToday(1)}>Tomorrow</button>
            <button className="btn secondary" onClick={()=> setDateRelativeToToday(2)}>Day after</button>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {resource==='NMR500' && (
              <div style={{fontSize:13,fontWeight:600,color:'#1f2937'}}>Active probe: {resInfo.active_probe || '—'}</div>
            )}
            <select className="select" value={selProbe} onChange={e=>setSelProbe(e.target.value)}>
              <option value="">Probe</option>
              {probes.map(p=> <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="select" value={selExp} onChange={e=>setSelExp(e.target.value)}>
              {experiments.map(x=> <option key={x} value={x}>{x}</option>)}
            </select>
            {resource==='NMR400' && selProbe==='BBO10' && (
              <div style={{fontWeight:800, color:'#b91c1c'}}>booking BBO10 use on NMR400 will require approval</div>
            )}
            {resource==='NMR500' && selProbe && resInfo?.active_probe && selProbe !== resInfo.active_probe && (
              <div style={{fontWeight:800, color:'#b91c1c'}}>booking {selProbe} use on NMR500 will require approval (active: {resInfo.active_probe})</div>
            )}
            {['STAFF','DANTE'].includes(role) && (
              <div style={{display:'grid', gap:8, width:'100%', marginTop:8, padding:8, border:'2px solid #f59e0b', borderRadius:8, background:'rgba(245,158,11,0.10)'}}>
                <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
                  <strong>Billing</strong>
                  <label style={{padding:'4px 8px', border:'1px solid var(--border)', borderRadius:8, background: billTo==='LAB'?'#111827':'#fff', color: billTo==='LAB'?'#fff':'inherit'}}>
                    <input type="radio" name="billto" checked={billTo==='LAB'} onChange={()=>setBillTo('LAB')}/> Own lab
                  </label>
                  <label style={{padding:'4px 8px', border:'1px solid var(--border)', borderRadius:8, background: billTo==='CLIENT'?'#111827':'#fff', color: billTo==='CLIENT'?'#fff':'inherit'}}>
                    <input type="radio" name="billto" checked={billTo==='CLIENT'} onChange={()=>setBillTo('CLIENT')}/> Client
                  </label>
                </div>
                {billTo==='CLIENT' && (
                  <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
                    <select className="select" value={selClient} onChange={e=>setSelClient(e.target.value)}>
                      <option value="">Select client</option>
                      {clients.map(c=> <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                    </select>
                    <label style={{display:'flex',alignItems:'center',gap:6}}>Total price (€)
                      <input className="input" type="number" value={totalPrice} onChange={e=>setTotalPrice(e.target.value)} step="0.01" style={{width:140}}/>
                    </label>
                  </div>
                )}
                <div style={{fontSize:12}}>
                  {billTo==='CLIENT' ? <span className="badge limited">Client-billed · no caps/advance · no mails</span> : <span className="badge ok">Lab-billed</span>}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="card" style={{padding:12}}>
          <div className="muted" style={{marginBottom:8}}>Tap a free slot to book</div>
          <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
          {slots.map((slot,i)=>{
            const occ = occupied(slot)
            const block = blockingOverlap(slot)
            const now = new Date()
            const isPast = slot.e < now
              let background = slotColorFor(slot.label)
              if (occ && (occ.status==='PENDING' || occ.status==='CANCEL_PENDING')) background = PENDING_SHADE
              if (isPast) background = slotColorFor('past')
              if(block) background = '#1f2937'
            return (
              <li key={i}
                    style={{border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px', background, color:block?'#fff':'inherit', transition:'background 120ms linear', cursor: (occ || block || isPast) ? 'default' : 'pointer'}}
                    onClick={()=> {
                      if(occ || block || isPast) return
                      if(!selProbe){ alert('Please select a probe before booking.'); return }
                      confirmBook(slot)
                    }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <strong>{fmtTime(slot.s)} → {fmtTime(slot.e)} · {slot.label}</strong>
                    {!occ && !block && <span className="muted">{selProbe ? 'Tap to book' : 'Select probe'}</span>}
                  </div>
                  <div className="muted" style={{marginTop:4}}>
                    {block ? (
                      <div style={{color:'#fff'}}>
                        {block.label}{block.reason ? ` · ${block.reason}` : ''}
                      </div>
                    ) : occ ? (
                      <div style={{display:'grid',gap:2}}>
                        <span>{occ.user_name || occ.user_email}{occ.status==='PENDING'?' · Pending approval':(occ.status==='CANCEL_PENDING'?' · Cancellation pending':'')}</span>
                        <span>ID {occ.id}</span>
                        {occ.bill_to_type === 'CLIENT' ? (
                          <span>Client ID: {occ.bill_to_client_id || '—'}{occ.client_name ? ` · ${occ.client_name}` : ''}</span>
                        ) : null}
                        <span>Experiment: {occ.experiment}</span>
                        {occ.probe ? <span>Probe: {occ.probe}</span> : null}
                      </div>
                    ) : 'available'}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        </div>
      </div>
    </div>
  )
}
