import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import {
  lisbonDateTimeToInstant,
  instantToLisbonDateTime,
  lisbonMidnightInstant,
  shiftLisbonMidnight,
  getLisbonWeekdayIndex,
  shiftLisbonDateParts,
  formatLisbon,
} from './utils/timezone.js'
const API = import.meta.env.VITE_API_URL || '/api'

const fmtDayHdr = (d)=> {
  const date = d instanceof Date ? d : new Date(d)
  return formatLisbon(date, { weekday:'short', day:'2-digit', month:'2-digit' })
}
const fmtDT = (d)=> {
  const x = d instanceof Date ? d : new Date(d)
  return formatLisbon(x, { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' })
}

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

function computeLisbonWeekStart(){
  const now = new Date()
  const midnight = lisbonMidnightInstant(now)
  const weekday = getLisbonWeekdayIndex(midnight)
  const backDays = (weekday + 6) % 7
  return shiftLisbonMidnight(midnight, -backDays)
}

export default function Grid({ token, role, email, onLogout }){
  const [resource,setResource] = useState('NMR300')
  const [weekStart,setWeekStart] = useState(()=> computeLisbonWeekStart())
  const days = useMemo(()=> [...Array(7)].map((_,i)=> shiftLisbonMidnight(weekStart, i)), [weekStart])

  const [experiments,setExperiments]=useState(['REGULAR','VT'])
  const [probes,setProbes]=useState([])
  const [busy,setBusy]=useState([])
  const [maintenance,setMaintenance]=useState([])
  const [training,setTraining]=useState([])
  const [pending,setPending]=useState(null) // {startISO,endISO,displayStart,displayEnd,experiment,probe,label}
  const [info,setInfo]=useState(null) // busy cell info popup
  const [msg,setMsg]=useState('')
  const [err,setErr]=useState(null) // last API error details
  const [showErr,setShowErr]=useState(false)
  const [selProbe,setSelProbe]=useState('')
  const [selExp,setSelExp]=useState('REGULAR')
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
  const [tzNotice,setTzNotice]=useState('')

  const renderBookingInfo = useCallback((booking) => {
    if(!booking) return null
    const displayName = booking.user_name || booking.user_email
    return (
      <div style={{fontSize:12, lineHeight:1.3}}>
        <div style={{fontWeight:600}}>{displayName}</div>
        <div className="muted">ID {booking.id}</div>
        {booking.bill_to_type === 'CLIENT' ? (
          <div className="muted">Client ID: {booking.bill_to_client_id || '—'}{booking.client_name ? ` · ${booking.client_name}` : ''}</div>
        ) : null}
        {booking.probe ? <div className="muted">Probe: {booking.probe}</div> : null}
      </div>
    )
  },[])

  // pick resource from URL if provided
  useEffect(()=>{
    const p = new URLSearchParams(location.search)
    const r = p.get('resource'); if (r) setResource(r)
  },[])

  // dynamic experiments list
  useEffect(()=>{
    fetch(`${API}/experiments`).then(r=>r.json()).then(j=>{
      if(Array.isArray(j)&&j.length) setExperiments(j)
    }).catch(()=>{})
  },[])

  useEffect(()=>{ setSelProbe(''); setSelExp('REGULAR') },[resource])
  useEffect(()=>{ setBillTo('LAB'); setSelClient(''); setTotalPrice('') },[resource])

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

  // resource metadata (active/default probe)
  useEffect(()=>{
    if(!resource) return
    fetch(`${API}/resource-info?resource=${encodeURIComponent(resource)}`)
      .then(async r=> r.ok? r.json():{
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
      .then(j=> setResInfo({
        active_probe: j?.active_probe||null,
        default_probe: j?.default_probe||null,
        color_hex: j?.color_hex||'',
        status: j?.status||'',
        limitation_note: j?.limitation_note||'',
        past_slot_color: j?.past_slot_color||'',
        slot_30m_color: j?.slot_30m_color||'',
        slot_3h_color: j?.slot_3h_color||'',
        slot_12h_color: j?.slot_12h_color||'',
        slot_24h_color: j?.slot_24h_color||'',
      }))
      .catch(()=> setResInfo({
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
      }))
  },[resource])

  // Clients list for STAFF/DANTE
  useEffect(()=>{
    if(!['STAFF','DANTE'].includes(role)) return
    fetch(`${API}/clients`,{ headers:{ 'Authorization': 'Bearer ' + (localStorage.getItem('tf_token')||'') } })
      .then(r=> r.ok? r.json():[])
      .then(j=> setClients(Array.isArray(j)? j: []))
      .catch(()=> setClients([]))
  },[role])

  useEffect(()=>{
    fetch(`${API}/resource-probes?resource=${encodeURIComponent(resource)}`)
      .then(async r => r.ok ? r.json() : [])
      .then(j => {
        let list = Array.isArray(j)? j : []
        if(resource==='NMR300') list = ['BBO5']
        setProbes(list); setMsg('');
        const def = (resInfo?.default_probe||'')
        if(def && list.includes(def)) setSelProbe(def)
        else setSelProbe('')
      })
      .catch(()=> { setProbes([]); setMsg('Failed to load probes') })
  },[resource, resInfo.default_probe])

  // fetch busy for the week
  useEffect(()=>{
    const firstDay = weekStart
    const lastDay = shiftLisbonMidnight(weekStart, 6)
    const weekEndInstant = lisbonDateTimeToInstant({
      ...instantToLisbonDateTime(lastDay),
      hour: 23,
      minute: 59,
      second: 59,
    })
    const s = firstDay.toISOString()
    const e = weekEndInstant.toISOString()
    fetch(`${API}/reservations/range?resource=${encodeURIComponent(resource)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      .then(async r => r.ok ? r.json() : [])
      .then(j => { setBusy(Array.isArray(j)? j : []); setMsg('') })
      .catch(()=> { setBusy([]); setMsg('Failed to load busy slots') })
  },[resource, weekStart])

  useEffect(()=>{
    const firstDay = weekStart
    const lastDay = shiftLisbonMidnight(weekStart, 6)
    const weekEndInstant = lisbonDateTimeToInstant({
      ...instantToLisbonDateTime(lastDay),
      hour: 23,
      minute: 59,
      second: 59,
    })
    const s = firstDay.toISOString()
    const e = weekEndInstant.toISOString()
    fetch(`${API}/maintenance?resource=${encodeURIComponent(resource)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      .then(async r => r.ok ? r.json() : [])
      .then(j => {
        if(Array.isArray(j)){
          const list = j.map(item => {
            const start = new Date(item.start_ts)
            const end = new Date(item.end_ts)
            return {
              ...item,
              start,
              end,
            }
          })
          setMaintenance(list)
        } else {
          setMaintenance([])
        }
      })
      .catch(()=> setMaintenance([]))
  },[resource, weekStart])

  useEffect(()=>{
    const firstDay = weekStart
    const lastDay = shiftLisbonMidnight(weekStart, 6)
    const weekEndInstant = lisbonDateTimeToInstant({
      ...instantToLisbonDateTime(lastDay),
      hour: 23,
      minute: 59,
      second: 59,
    })
    const s = firstDay.toISOString()
    const e = weekEndInstant.toISOString()
    fetch(`${API}/training?resource=${encodeURIComponent(resource)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      .then(async r => r.ok ? r.json() : [])
      .then(j => {
        if(Array.isArray(j)){
          const list = j.map(item => {
            const start = new Date(item.start_ts)
            const end = new Date(item.end_ts)
            return {
              ...item,
              start,
              end,
            }
          })
          setTraining(list)
        } else {
          setTraining([])
        }
      })
      .catch(()=> setTraining([]))
  },[resource, weekStart])

  // slots by rules
  const slots = useMemo(()=>{
    const perDay = days.map(dayInstant => {
      const list = []
      const dow = getLisbonWeekdayIndex(dayInstant)
      const dayParts = instantToLisbonDateTime(dayInstant)

      const addSlot = (start, end, label) => {
        list.push({ s: start, e: end, label })
      }

      if(dow === 6 || dow === 0){
        const start = lisbonDateTimeToInstant({ ...dayParts, hour:8, minute:0, second:0 })
        const nextDayParts = shiftLisbonDateParts(dayParts, 1)
        const end = lisbonDateTimeToInstant({ ...nextDayParts, hour:8, minute:0, second:0 })
        addSlot(start, end, '24h')
        return list
      }

      const pushSeries = (h1, m1, h2, m2, label, stepMinutes) => {
        let cursor = lisbonDateTimeToInstant({ ...dayParts, hour: h1, minute: m1, second: 0 })
        let limit = lisbonDateTimeToInstant({ ...dayParts, hour: h2, minute: m2, second: 0 })
        if (h2 < h1 || (h2 === h1 && m2 < m1)){
          const nextDayParts = shiftLisbonDateParts(dayParts, 1)
          limit = lisbonDateTimeToInstant({ ...nextDayParts, hour: h2, minute: m2, second: 0 })
        }
        while (cursor < limit){
          const slotEnd = new Date(cursor.getTime() + stepMinutes * 60000)
          addSlot(cursor, slotEnd, label)
          cursor = slotEnd
        }
      }

      if(resource === 'NMR300'){
        pushSeries(8,0,14,0,'30m',30)
        pushSeries(14,0,20,0,'3h',180)
        const start = lisbonDateTimeToInstant({ ...dayParts, hour:20, minute:0, second:0 })
        const nextDayParts = shiftLisbonDateParts(dayParts, 1)
        const end = lisbonDateTimeToInstant({ ...nextDayParts, hour:8, minute:0, second:0 })
        addSlot(start, end, '12h')
      } else if (resource === 'NMR400'){
        pushSeries(11,0,14,0,'30m',30)
        pushSeries(8,0,11,0,'3h',180)
        pushSeries(14,0,20,0,'3h',180)
        const start = lisbonDateTimeToInstant({ ...dayParts, hour:20, minute:0, second:0 })
        const nextDayParts = shiftLisbonDateParts(dayParts, 1)
        const end = lisbonDateTimeToInstant({ ...nextDayParts, hour:8, minute:0, second:0 })
        addSlot(start, end, '12h')
      } else if (resource === 'NMR500'){
        pushSeries(8,0,20,0,'3h',180)
        const start = lisbonDateTimeToInstant({ ...dayParts, hour:20, minute:0, second:0 })
        const nextDayParts = shiftLisbonDateParts(dayParts, 1)
        const end = lisbonDateTimeToInstant({ ...nextDayParts, hour:8, minute:0, second:0 })
        addSlot(start, end, '12h')
      }

      return list
    })

    const signature = (slot) => {
      const startParts = instantToLisbonDateTime(slot.s)
      const endParts = instantToLisbonDateTime(slot.e)
      return {
        key: `${startParts.hour}:${startParts.minute}__${endParts.hour}:${endParts.minute}__${slot.label}`,
        h: startParts.hour,
        m: startParts.minute,
      }
    }

    const rowSet = new Map()
    perDay.forEach(list => {
      list.forEach(slot => {
        if (slot.label === '24h') return
        const sig = signature(slot)
        if (!rowSet.has(sig.key)){
          rowSet.set(sig.key, { h: sig.h, m: sig.m, label: slot.label })
        }
      })
    })

    const rows = [...rowSet.entries()].map(([key, meta]) => ({ key, h: meta.h, m: meta.m, label: meta.label }))
    rows.sort((a,b)=> a.h === b.h ? a.m - b.m : a.h - b.h)

    return { perDay, rows }
  },[days, resource])

  const busyKey = (s,e)=> `${new Date(s).toISOString()}__${new Date(e).toISOString()}`
  const busyMaps = useMemo(()=>{
    const set=new Set(); const map=new Map();
    for(const b of busy){ const k=busyKey(b.start_ts,b.end_ts); set.add(k); map.set(k,b) }
    return { set, map }
  },[busy])

  const blockingRanges = useMemo(()=>{
    const ensureValid = (entry)=>{
      if(!entry) return false
      const startValid = entry.start instanceof Date && !Number.isNaN(entry.start?.getTime?.())
      const endValid = entry.end instanceof Date && !Number.isNaN(entry.end?.getTime?.())
      return startValid && endValid
    }
    const mapList = (list, type)=> list.filter(ensureValid).map(item=> ({...item, type, label: type==='training' ? 'Training' : 'Maintenance'}))
    return [
      ...mapList(maintenance, 'maintenance'),
      ...mapList(training, 'training'),
    ]
  },[maintenance, training])

  const findBlockingOverlap = useCallback((slotStart, slotEnd) => {
    for(const block of blockingRanges){
      if(slotStart < block.end && block.start < slotEnd) return block
    }
    return null
  },[blockingRanges])

  const longSlotInfoRow = Math.min(Math.max(slots.rows.length - 1, 0), 2)

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
    if (resInfo.limitation_note) lines.push(resInfo.limitation_note)
    if (resInfo.default_probe) lines.push(`Default probe: ${resInfo.default_probe}`)
    if (resInfo.active_probe) lines.push(`Active probe: ${resInfo.active_probe}`)
    return lines
  },[resInfo.status, resInfo.limitation_note, resInfo.default_probe, resInfo.active_probe])

  function shadeFor(label, d){
    const weekend = [0,6].includes(getLisbonWeekdayIndex(d))
    if (weekend) return 'var(--slot-weekend)'
    return slotColorFor(label)
  }

  function clickSlot(s,e,label){
    if(!selProbe){ alert('Please select a probe before booking.'); return }
    // default experiment+probe
    const experiment = selExp || 'REGULAR'
    const probe = selProbe // must be selected
    const startParts = instantToLisbonDateTime(s)
    const endParts = instantToLisbonDateTime(e)
    const startInstant = lisbonDateTimeToInstant(startParts)
    const endInstant = lisbonDateTimeToInstant(endParts)
    setPending({
      startISO: startInstant.toISOString(),
      endISO: endInstant.toISOString(),
      displayStart: startInstant,
      displayEnd: endInstant,
      label,
      experiment,
      probe,
    })
  }

  async function confirmBook(){
    if (!pending) return
    try{
      const r = await fetch(`${API}/reservations/create`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('tf_token')||''}`},
        body: JSON.stringify({
          email: localStorage.getItem('tf_email')||'',
          resource,
          start: pending.startISO,
          end: pending.endISO,
          experiment: pending.experiment, probe: pending.probe, label: pending.label,
          ...( ['STAFF','DANTE'].includes(role) && billTo==='CLIENT' ? {
            bill_to_type:'CLIENT',
            bill_to_client_id: selClient ? Number(selClient) : null,
            total_price_eur: (totalPrice || totalPrice===0) ? Number(totalPrice) : 0
          } : {} )
        })
      })
      const raw = await r.text(); let j=null; try{ j = raw? JSON.parse(raw) : null }catch(_){ }
      if(!r.ok){
        const msg = (j&&j.error) ? j.error : (raw||`HTTP ${r.status}`)
        setMsg(String(msg).toUpperCase())
        setErr(j||{ raw })
        setShowErr(false)
        return
      }
      const data = j
      alert('Booking created')
      if (data && data.status === 'PENDING') {
        alert('This booking requires approval. Management will review it and you will be informed upon approval.')
      }
      setPending(null)
      setErr(null); setShowErr(false)
      // refetch busy
      const s = days[0].toISOString()
      const lastDayParts = instantToLisbonDateTime(days[6])
      const weekEndInstant = lisbonDateTimeToInstant({ ...lastDayParts, hour: 23, minute: 59, second: 59 })
      const e = weekEndInstant.toISOString()
      const rr = await fetch(`${API}/reservations/range?resource=${encodeURIComponent(resource)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      setBusy(await rr.json())
    }catch(error){
      const m = String(error.message||error).toUpperCase()
      setMsg(m)
      setErr({ error:m })
      setShowErr(false)
    }
  }

  return (
    <div>
      <Nav token={token} email={email} role={role} onLogout={onLogout}/>
      <div style={{background: (resInfo.color_hex && resInfo.color_hex.trim()) ? resInfo.color_hex.trim() : 'var(--bg)', transition:'background 120ms linear'}}>
        <div style={{maxWidth:1100,margin:'20px auto',padding:'0 12px'}}>
        <p style={{minHeight:18,color:'#6b7280'}}>{msg}</p>
        {tzNotice && (
          <div style={{marginBottom:12,padding:'10px 12px',border:'1px solid #fcd34d',background:'#fffbeb',borderRadius:10,color:'#92400e',fontSize:14}}>
            {tzNotice}
          </div>
        )}
        <div className="card" style={{marginBottom:12, borderColor:statusColor, background:statusColor, color:'#fff', transition:'background 120ms linear'}}>
          <div style={{display:'flex',gap:16,alignItems:'stretch',flexWrap:'wrap'}}>
            <div style={{flex:'1 1 260px',display:'grid',gap:6}}>
              {resourceStatusLines.map((line, idx)=> (
                <div
                  key={idx}
                  style={{fontSize:idx===0?14:13,fontWeight:idx===0?700:500,opacity: idx===0?1:0.88}}>
                  {line}
                </div>
              ))}
              {!resourceStatusLines.length && (
                <div style={{fontSize:13,fontWeight:500}}>Status information unavailable</div>
              )}
            </div>
            <div style={{flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:36,textTransform:'uppercase',padding:'0 12px',opacity:0.9}}>
              {resource}
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:12}}>
          <label>Resource:
            <select value={resource} onChange={e=>setResource(e.target.value)} style={{marginLeft:8}}>
              <option>NMR300</option>
              <option>NMR400</option>
              <option>NMR500</option>
            </select>
          </label>
          {resource==='NMR500' && (
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'#374151',fontWeight:600}}>
              <span>Active probe:</span>
              <span>{resInfo.active_probe || '—'}</span>
            </div>
          )}
          <label>Probe:
            <select value={selProbe} onChange={e=>setSelProbe(e.target.value)} style={{marginLeft:8}}>
              <option value="">Select:</option>
              {probes.map(p=> <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>Experiment:
            <select value={selExp} onChange={e=>setSelExp(e.target.value)} style={{marginLeft:8}}>
              {experiments.map(e=> <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={()=>setWeekStart(prev => shiftLisbonMidnight(prev, -7))}>{'←'}</button>
            <strong style={{minWidth:160,textAlign:'center'}}>
              {formatLisbon(days[0], { year:'numeric', month:'2-digit', day:'2-digit' })} – {formatLisbon(days[6], { year:'numeric', month:'2-digit', day:'2-digit' })}
            </strong>
            <button onClick={()=>setWeekStart(prev => shiftLisbonMidnight(prev, 7))}>{'→'}</button>
            <button className="btn secondary" onClick={()=>setWeekStart(computeLisbonWeekStart())}>Today</button>
          </div>
        </div>
        {resource==='NMR400' && selProbe==='BBO10' && (
          <div style={{marginBottom:8, fontWeight:800, color:'#b91c1c'}}>
            booking BBO10 use on NMR400 will require approval
          </div>
        )}

        {['STAFF','DANTE'].includes(role) && (
          <div className="card" style={{padding:12, marginBottom:12, borderColor:'#f59e0b', background:'linear-gradient(180deg, rgba(245,158,11,0.10), rgba(255,255,255,0.9))'}}>
            <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{fontWeight:800}}>Billing</div>
              <label style={{display:'flex',alignItems:'center',gap:6, padding:'4px 8px', border:'1px solid var(--border)', borderRadius:8, background: billTo==='LAB'?'#111827':'#fff', color: billTo==='LAB'?'#fff':'inherit'}}>
                <input type="radio" name="billto" checked={billTo==='LAB'} onChange={()=>setBillTo('LAB')}/> Own lab
              </label>
              <label style={{display:'flex',alignItems:'center',gap:6, padding:'4px 8px', border:'1px solid var(--border)', borderRadius:8, background: billTo==='CLIENT'?'#111827':'#fff', color: billTo==='CLIENT'?'#fff':'inherit'}}>
                <input type="radio" name="billto" checked={billTo==='CLIENT'} onChange={()=>setBillTo('CLIENT')}/> Client
              </label>
              {billTo==='CLIENT' && (
                <>
                  <select value={selClient} onChange={e=>setSelClient(e.target.value)} style={{minWidth:160}}>
                    <option value="">Select client</option>
                    {clients.map(c=> <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                  <label style={{display:'flex',alignItems:'center',gap:6}}>Total price (€)
                    <input type="number" value={totalPrice} onChange={e=>setTotalPrice(e.target.value)} step="0.01" style={{width:140}}/>
                  </label>
                </>
              )}
            </div>
            <div style={{marginTop:6, fontSize:12}}>
              {billTo==='CLIENT' ? (
                <span className="badge limited" title="Client billing active">Client-billed · no caps/advance · no mails</span>
              ) : (
                <span className="badge ok" title="Lab billing active">Lab-billed · normal policies</span>
              )}
            </div>
          </div>
        )}

        {['STAFF','DANTE'].includes(role) && billTo==='CLIENT' && (
          <div style={{marginBottom:12, padding:'6px 10px', border:'2px dashed #f59e0b', borderRadius:8, background:'rgba(245,158,11,0.10)'}}>
            Billing: <b>Client</b>{selClient?` · ${(clients.find(c=>String(c.id)===String(selClient))||{}).name||''}`:''}{typeof totalPrice==='string' && totalPrice!==''?` · Total €${Number(totalPrice).toFixed(2)}`:''}
          </div>
        )}
        {resource==='NMR500' && selProbe && resInfo?.active_probe && selProbe !== resInfo.active_probe && (
          <div style={{marginBottom:8, fontWeight:800, color:'#b91c1c'}}>
            booking {selProbe} use on NMR500 will require approval (active: {resInfo.active_probe})
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'140px repeat(7, 1fr)',border:'1px solid #cbd5e1',borderRadius:8,overflow:'hidden'}}>
          <div style={{background:'#f9fafb',padding:8,fontWeight:600,borderBottom:'1px solid #cbd5e1'}}>Time</div>
          {days.map((d,i)=>(
            <div key={i} style={{background:'#f9fafb',padding:8,fontWeight:600,textAlign:'center',borderBottom:'1px solid #cbd5e1',borderLeft:'1px solid #cbd5e1'}}>
              {fmtDayHdr(d)}
            </div>
          ))}

          {slots.rows.map((row,idx)=>{
            const humanLabel = row.label==='30m' ? '30 min' : row.label==='3h' ? '3 h' : row.label==='12h' ? '12 h' : row.label
            const rowHeight = row.label==='30m' ? 36 : row.label==='3h' ? 72 : row.label==='12h' ? 144 : 36
            return (
              <React.Fragment key={idx}>
                <div style={{padding:8,borderTop:'1px solid #cbd5e1',background:'#fff',minHeight:rowHeight}}>
                  <div>
                    {(() => {
                      const sh = String(row.h).padStart(2,'0')
                      const sm = String(row.m).padStart(2,'0')
                      const startTotal = row.h * 60 + row.m
                      let endTotal = startTotal
                      if(row.label === '30m') endTotal += 30
                      else if(row.label === '3h') endTotal += 180
                      else if(row.label === '12h') endTotal += 720
                      endTotal = (endTotal + (24 * 60)) % (24 * 60)
                      const eh = String(Math.floor(endTotal / 60)).padStart(2,'0')
                      const em = String(endTotal % 60).padStart(2,'0')
                      return `${sh}:${sm} → ${eh}:${em}`
                    })()}
                  </div>
                  <div style={{fontSize:12,color:'#6b7280'}}>{humanLabel}</div>
                </div>
                {days.map((d,j)=>{
                  const list = slots.perDay[j]
                  const dayHas24 = list.some(x=> x.label==='24h')
                  const match = list.find(x=> {
                    const startParts = instantToLisbonDateTime(x.s)
                    const endParts = instantToLisbonDateTime(x.e)
                    const key = `${startParts.hour}:${startParts.minute}__${endParts.hour}:${endParts.minute}__${x.label}`
                    return key === row.key
                  })
                  if(!match){
                    if(dayHas24){
                      const slot24 = list.find(x=> x.label==='24h')
                      if(!slot24){
                        return <div key={j} style={{borderTop:'none',borderLeft:'1px solid #cbd5e1',background: shadeFor('24h', d), minHeight: rowHeight}} />
                      }
                      const showContent = idx === longSlotInfoRow
                      const block24 = findBlockingOverlap(slot24.s, slot24.e)
                      if(block24){
                        const blockLabel = block24.label || (block24.type==='training'?'Training':'Maintenance')
                        const style24Maintenance = {
                          borderLeft:'1px solid #cbd5e1',
                          borderTop: idx===0 ? '1px solid #cbd5e1' : 'none',
                          background:'#999999',
                          minHeight: rowHeight,
                          padding: showContent ? 12 : 4,
                          display:'flex',
                          alignItems:'center',
                          justifyContent:'center',
                          color:'#fff',
                          fontWeight:700,
                          cursor:'not-allowed'
                        }
                        const title = block24.reason ? `${blockLabel} - ${block24.reason}` : blockLabel
                        return (
                          <div key={j} style={style24Maintenance} title={title}>
                            {showContent ? blockLabel : null}
                          </div>
                        )
                      }
                      let bg = shadeFor('24h', d)
                      const k24 = busyKey(slot24.s, slot24.e)
                      const isBusy24 = busyMaps.set.has(k24)
                      const info24 = isBusy24 ? busyMaps.map.get(k24) : null
                      const now = new Date()
                      const isPast = slot24.e < now
                      if (info24 && (info24.status==='PENDING' || info24.status==='CANCEL_PENDING')) bg = PENDING_SHADE
                      if (isPast) bg = slotColorFor('past')
                      const style24 = {
                        borderLeft:'1px solid #cbd5e1',
                        borderTop: idx===0 ? '1px solid #cbd5e1' : 'none',
                        background:bg,
                        minHeight: rowHeight,
                        padding: showContent ? 12 : 4,
                        cursor: isPast ? 'not-allowed' : 'pointer',
                        display:'flex',
                        flexDirection:'column',
                        justifyContent: showContent ? 'flex-end' : 'center',
                        gap: showContent ? 6 : 0
                      }
                      return (
                        <div key={j} style={style24} title={isBusy24?'View booking details':'Click to book 24 h'}
                             onClick={()=> isPast ? null : (isBusy24 ? setInfo({ ...info24 }) : clickSlot(slot24.s, slot24.e, '24h'))}>
                          {showContent ? (
                            isBusy24 ? renderBookingInfo(info24) : (
                              isPast ? null : <div className="muted">Click to book 24 h</div>
                            )
                          ) : null}
                        </div>
                      )
                    }
                    return <div key={j} style={{borderTop:'1px solid #cbd5e1',borderLeft:'1px solid #cbd5e1',background: '#fff', minHeight: rowHeight}} />
                  }
                  const blockingHit = findBlockingOverlap(match.s, match.e)
                  if(blockingHit){
                    const blockLabel = blockingHit.label || (blockingHit.type==='training'?'Training':'Maintenance')
                    const maintenanceStyle = {
                      borderTop:'1px solid #cbd5e1',
                      borderLeft:'1px solid #cbd5e1',
                      background:'#1f2937',
                      cursor:'not-allowed',
                      opacity:1,
                      padding:8,
                      minHeight: rowHeight,
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      gap:0,
                      color:'#fff',
                      fontWeight:700
                    }
                    const title = blockingHit.reason ? `${blockLabel} - ${blockingHit.reason}` : blockLabel
                    return (
                      <div key={j} style={maintenanceStyle} title={title}>
                        {blockLabel}
                      </div>
                    )
                  }
                  const k = busyKey(match.s, match.e)
                  const isBusy = busyMaps.set.has(k)
                  const now = new Date()
                  const isPast = match.e < now
                  let bg = shadeFor(match.label,d)
                  const info = isBusy ? busyMaps.map.get(k) : null
                  if (info && (info.status==='PENDING' || info.status==='CANCEL_PENDING')) bg = PENDING_SHADE
                  if (isPast) bg = slotColorFor('past')
                  const style = {
                    borderTop:'1px solid #cbd5e1',
                    borderLeft:'1px solid #cbd5e1',
                    background: bg,
                    cursor: 'pointer',
                    opacity: isBusy ? 0.95 : 1,
                    padding: 8,
                    minHeight: rowHeight,
                    display:'flex',
                    flexDirection:'column',
                    alignItems:'flex-start',
                    justifyContent: isBusy ? 'flex-start' : 'center',
                    gap:6,
                    color:'#001219'
                  }
                  return (
                    <div key={j} title={isBusy?'View booking details':'Click to book'} style={style}
                         onClick={()=> isBusy ? setInfo({ ...info }) : clickSlot(match.s,match.e,match.label)}>
                      {isBusy ? renderBookingInfo(info) : null}
                    </div>
                  )
                })}
              </React.Fragment>
            )
          })}
        </div>

        {pending && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'grid',placeItems:'center'}}>
            <div style={{width:380,background:'#fff',borderRadius:12,padding:16,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}}>
              <h3 style={{marginTop:0}}>Confirm booking</h3>
              <p style={{lineHeight:1.5}}>
                <b>{resource}</b><br/>
                Experiment: <b>{pending.experiment}</b><br/>
                Probe: <b>{pending.probe}</b><br/>
                From: <b>{fmtDT(pending.displayStart)}</b><br/>
                To: <b>{fmtDT(pending.displayEnd)}</b><br/>
                {['STAFF','DANTE'].includes(role) && (
                  <>Bill to: <b>{billTo==='CLIENT' ? `Client${selClient?` · ${(clients.find(c=>String(c.id)===String(selClient))||{}).name||''}`:''}` : 'Own lab'}</b>{billTo==='CLIENT'?<> · Total: <b>€{Number(totalPrice||0).toFixed(2)}</b></>:null}</>
                )}
              </p>
              {err && (
                <div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',padding:8,borderRadius:8,marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <strong style={{color:'#991B1B'}}>Error</strong>
                    <button className="btn secondary" onClick={()=>setShowErr(s=>!s)}>{showErr?'Hide details':'View details'}</button>
                  </div>
                  {showErr && (
                    <pre style={{whiteSpace:'pre-wrap',fontSize:12,marginTop:8,maxHeight:180,overflow:'auto'}}>{JSON.stringify(err,null,2)}</pre>
                  )}
                </div>
              )}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button onClick={()=>{ setPending(null); setErr(null); setShowErr(false) }}>Cancel</button>
                <button onClick={confirmBook}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        {info && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'grid',placeItems:'center'}}>
            <div style={{width:420,background:'#fff',borderRadius:12,padding:16,boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}}>
              <h3 style={{marginTop:0}}>Booking details</h3>
              <p style={{lineHeight:1.5}}>
                <b>{info.resource}</b><br/>
                User: <b>{info.user_name||info.user_email}</b> ({info.user_email})<br/>
                Lab: <b>{info.user_lab||'—'}</b><br/>
                {info.bill_to_type === 'CLIENT' ? (
                  <>Client ID: <b>{info.bill_to_client_id || '—'}</b>{info.client_name ? <> ({info.client_name})</> : null}<br/></>
                ) : null}
                Experiment: <b>{info.experiment}</b><br/>
                Probe: <b>{info.probe}</b><br/>
                From: <b>{fmtDT(info.start_ts)}</b><br/>
                To: <b>{fmtDT(info.end_ts)}</b><br/>
                Status: <b>{info.status}</b><br/>
                ID: <b>{info.id}</b>
              </p>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button onClick={()=>setInfo(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
      <Footer/>
    </div>
  )
}
