import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

function fmtDT(d){
  const x = new Date(d)
  const pad = n=> String(n).padStart(2,'0')
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`
}

function ResourceDay({ name, tick }){
  const [busy,setBusy]=useState([])
  const [maintenance,setMaintenance]=useState([])
  const [training,setTraining]=useState([])
  const [msg,setMsg]=useState('')

  function buildSlots(){
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const list=[]
    const add=(h1,m1,h2,m2,label)=>{
      const s=new Date(d); s.setHours(h1,m1,0,0)
      const e=new Date(s); e.setHours(h2,m2,0,0)
      if(e <= s) e.setDate(e.getDate()+1)
      list.push({ s, e, label })
    }
    const dow = d.getDay()
    if(dow===6 || dow===0){
      // Weekend: show a single row for the visible day 08:00→24:00
      add(8,0,24,0,'24h')
      return list
    }
    if(name==='NMR300'){
      // 08–14 in 30m
      let sH=8, sM=0
      while(sH<14 || (sH===14 && sM===0)){
        const eM = sM+30; let eH=sH; let eMin=eM; if(eM>=60){ eH++; eMin=eM-60 }
        add(sH,sM,eH,eMin,'30m')
        sH=eH; sM=eMin; if(sH===14 && sM===0) break
      }
      // 14–20 in 3h blocks
      add(14,0,17,0,'3h'); add(17,0,20,0,'3h')
      // Show 20–24 as part of the overnight 12h as one line
      add(20,0,24,0,'12h')
    } else if(name==='NMR400'){
      // 08–11 3h, 11–14 30m, 14–20 3h
      add(8,0,11,0,'3h')
      let sH=11, sM=0
      while(sH<14 || (sH===14 && sM===0)){
        const eM = sM+30; let eH=sH; let eMin=eM; if(eM>=60){ eH++; eMin=eM-60 }
        add(sH,sM,eH,eMin,'30m')
        sH=eH; sM=eMin; if(sH===14 && sM===0) break
      }
      add(14,0,17,0,'3h'); add(17,0,20,0,'3h')
      add(20,0,24,0,'12h')
    } else if(name==='NMR500'){
      // 08–20 in 3h
      add(8,0,11,0,'3h'); add(11,0,14,0,'3h'); add(14,0,17,0,'3h'); add(17,0,20,0,'3h')
      add(20,0,24,0,'12h')
    }
    return list
  }

  const slots = buildSlots()

  useEffect(()=>{
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const s = start.toISOString(), e = end.toISOString()
    fetch(`${API}/reservations/range?resource=${encodeURIComponent(name)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      .then(async r=> r.ok? r.json():[])
      .then(j=> { setBusy(Array.isArray(j)? j : []); setMsg('') })
      .catch(()=> { setBusy([]); setMsg('Failed to load') })
    fetch(`${API}/maintenance?resource=${encodeURIComponent(name)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      .then(async r=> r.ok? r.json():[])
      .then(j=> setMaintenance(Array.isArray(j)? j : []))
      .catch(()=> setMaintenance([]))
    fetch(`${API}/training?resource=${encodeURIComponent(name)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`)
      .then(async r=> r.ok? r.json():[])
      .then(j=> setTraining(Array.isArray(j)? j : []))
      .catch(()=> setTraining([]))
  },[name, tick])

  return (
    <div style={{border:'1px solid #e5e7eb',borderRadius:12,overflow:'hidden',background:'#fff'}}>
      <div style={{padding:12,fontWeight:700,background:'#f9fafb'}}>{name}</div>
      <div style={{padding:12,minHeight:120}}>
        <div style={{color:'#6b7280',fontSize:12,marginBottom:8}}>{msg}</div>
        <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:8}}>
          {slots.map((slot, idx)=>{
            const overlap = (range)=>{
              const bs = new Date(range.start_ts), be = new Date(range.end_ts)
              return bs < slot.e && be > slot.s
            }
            const maintenanceHit = maintenance.find(overlap)
            const trainingHit = !maintenanceHit ? training.find(overlap) : null
            const occupied = !maintenanceHit && !trainingHit ? busy.find(overlap) : null
            let cls = 'available'
            if(maintenanceHit) cls='maintenance'
            else if(trainingHit) cls='training'
            else if(occupied) cls = (occupied.status==='PENDING'||occupied.status==='CANCEL_PENDING') ? 'pending' : 'booked'
            return (
              <li key={idx} className={`slot-card ${cls}`}>
                <div>
                  <span className="slot-time">{fmtDT(slot.s)} → {fmtDT(slot.e)}</span>
                  <span className="slot-meta" style={{marginLeft:8}}>· {slot.label}</span>
                </div>
                <div className="slot-meta" style={{marginTop:4}}>
                  {maintenanceHit ? (
                    <div>Maintenance{maintenanceHit.reason ? ` · ${maintenanceHit.reason}` : ''}</div>
                  ) : trainingHit ? (
                    <div>Training{trainingHit.reason ? ` · ${trainingHit.reason}` : ''}</div>
                  ) : occupied ? (
                    <>
                      <div>{occupied.user_name || occupied.user_email} · ID {occupied.id} {(occupied.status==='PENDING'||occupied.status==='CANCEL_PENDING') ? '· Pending' : ''}</div>
                      {occupied.bill_to_type === 'CLIENT' ? (
                        <div>Client ID: {occupied.bill_to_client_id || '—'}{occupied.client_name ? ` · ${occupied.client_name}` : ''}</div>
                      ) : null}
                      <div>Exp: {occupied.experiment} · Probe: {occupied.probe}</div>
                    </>
                  ) : 'available'}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export default function Display(){
  const [dateStr,setDateStr]=useState(()=>{
    const d=new Date(); const pad=n=> String(n).padStart(2,'0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`
  })
  const [tick,setTick]=useState(0)
  useEffect(()=>{
    const id = setInterval(()=> setTick(x=>x+1), 5*60*1000)
    return ()=> clearInterval(id)
  },[])
  return (
    <div style={{minHeight:'100vh',background:'#f3f4f6',padding:16,paddingBottom:'calc(var(--footer-h) + 24px)'}}>
      <div style={{maxWidth:1200, margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h2 style={{margin:0, width:'100%', textAlign:'center', fontWeight:800}}>Current Usage</h2>
          <div style={{color:'#6b7280'}}>Day: {dateStr} (08:00 → 24:00) · refreshed every 5 min</div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginBottom:8}}>
          <span className="slot-card available" style={{padding:'4px 8px'}}>Available</span>
          <span className="slot-card booked" style={{padding:'4px 8px'}}>Booked</span>
          <span className="slot-card pending" style={{padding:'4px 8px'}}>Pending</span>
          <span className="slot-card maintenance" style={{padding:'4px 8px'}}>Maintenance</span>
          <span className="slot-card training" style={{padding:'4px 8px'}}>Training</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:12}}>
          {['NMR300','NMR400','NMR500'].map(r=> <ResourceDay key={r} name={r} tick={tick}/>)}
        </div>
      </div>
    </div>
  )
}
