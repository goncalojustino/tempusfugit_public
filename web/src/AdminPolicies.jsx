import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminPolicies({token}){
  const [caps,setCaps]=useState([])
  const [cuts,setCuts]=useState([])
  const [msg,setMsg]=useState('')

  async function load(){
    try{
      const r1 = await fetch(`${API}/admin/caps`,{ headers:{'Authorization':'Bearer '+token} })
      const j1 = await r1.json(); if(!r1.ok){ setMsg(j1.error||'Failed to load caps') }
      const r2 = await fetch(`${API}/admin/cancel_rules`,{ headers:{'Authorization':'Bearer '+token} })
      const j2 = await r2.json(); if(!r2.ok){ setMsg(prev=> prev||j2.error||'Failed to load cancel rules') }
      setCaps(Array.isArray(j1)?j1:[]); setCuts(Array.isArray(j2)?j2:[])
      if(r1.ok && r2.ok) setMsg('')
    }catch{ setCaps([]); setCuts([]); setMsg('Failed to load policies') }
  }
  useEffect(()=>{ load() },[])

  async function saveCap(row){
    setMsg('Saving cap…')
    const r=await fetch(`${API}/admin/caps/upsert`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(row)
    })
    const j=await r.json(); if(!r.ok){ setMsg((j.error||'ERROR') + (j.detail?`: ${j.detail}`:'')); return }
    setMsg('Saved'); load()
  }
  async function delCap(row){
    if(!confirm('Delete cap?')) return
    const r=await fetch(`${API}/admin/caps/delete`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({resource:row.resource, block_label:row.block_label})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    load()
  }
  async function resetCaps(){
    setMsg('Resetting caps…')
    try{
      const r=await fetch(`${API}/admin/caps/reset_defaults`,{ method:'POST', headers:{'Authorization':'Bearer '+token} })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
      setMsg(`Caps reset (${j.inserted} rows)`); load()
    }catch{ setMsg('ERROR') }
  }
  async function saveCut(row){
    setMsg('Saving cutoff…')
    const r=await fetch(`${API}/admin/cancel_rules/upsert`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(row)
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Saved'); load()
  }
  async function delCut(row){
    if(!confirm('Delete cutoff?')) return
    const r=await fetch(`${API}/admin/cancel_rules/delete`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({resource:row.resource, block_label:row.block_label})
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    load()
  }

  function edit(list,setter,idx,patch){
    setter(list.map((r,i)=> i===idx? {...r,...patch} : r))
  }

  return (
    <div>
      <h3>Policy: anti-stockpiling caps</h3>
      <p>{msg}</p>
      <div style={{marginBottom:8}}>
        <button className="btn secondary" onClick={resetCaps}>Reset to defaults</button>
      </div>
      <table>
        <thead><tr><th>Resource</th><th>Block</th><th>Per-day hours</th><th>Per-week hours</th><th></th></tr></thead>
        <tbody>
          {caps.map((c,i)=>
            <tr key={`${c.resource}-${c.block_label}`}>
              <td>
                <select value={c.resource} onChange={e=>edit(caps,setCaps,i,{resource:e.target.value})}>
                  <option>NMR300</option><option>NMR400</option><option>NMR500</option>
                </select>
              </td>
              <td>
                <select value={c.block_label} onChange={e=>edit(caps,setCaps,i,{block_label:e.target.value})}>
                  <option>30m</option><option>3h</option><option>12h</option><option>24h</option>
                </select>
              </td>
              <td><input type="number" value={c.per_day_hours||0}
                  onChange={e=>edit(caps,setCaps,i,{per_day_hours:Number(e.target.value)})}/></td>
              <td><input type="number" value={c.per_week_hours||0}
                  onChange={e=>edit(caps,setCaps,i,{per_week_hours:Number(e.target.value)})}/></td>
              <td>
                <button onClick={()=>saveCap(caps[i])}>Save</button>
                <button onClick={()=>delCap(caps[i])}>Delete</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{marginTop:8}}>
        <button className="btn secondary" onClick={()=> setCaps([...caps, { resource:'NMR300', block_label:'30m', per_day_hours:0, per_week_hours:0 }])}>Add cap row</button>
      </div>

      <h3 style={{marginTop:24}}>Policy: cancellation cutoffs</h3>
      <table>
        <thead><tr><th>Resource</th><th>Block</th><th>Cutoff hours</th><th></th></tr></thead>
        <tbody>
          {cuts.map((c,i)=>
            <tr key={`${c.resource}-${c.block_label}`}>
              <td>
                <select value={c.resource} onChange={e=>edit(cuts,setCuts,i,{resource:e.target.value})}>
                  <option>NMR300</option><option>NMR400</option><option>NMR500</option>
                </select>
              </td>
              <td>
                <select value={c.block_label} onChange={e=>edit(cuts,setCuts,i,{block_label:e.target.value})}>
                  <option>30m</option><option>3h</option><option>12h</option><option>24h</option>
                </select>
              </td>
              <td><input type="number" value={Math.round((c.cutoff_minutes||0)/60)}
                  onChange={e=>edit(cuts,setCuts,i,{cutoff_minutes:Number(e.target.value)*60})}/></td>
              <td>
                <button onClick={()=>saveCut(cuts[i])}>Save</button>
                <button onClick={()=>delCut(cuts[i])}>Delete</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div style={{marginTop:8}}>
        <button className="btn secondary" onClick={()=> setCuts([...cuts, { resource:'NMR300', block_label:'30m', cutoff_minutes:0 }])}>Add cutoff row</button>
      </div>
    </div>
  )
}
