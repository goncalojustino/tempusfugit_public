import React, { useEffect, useMemo, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminBulletin({ token }){
  const [text,setText]=useState('')
  const [current,setCurrent]=useState('')
  const [msg,setMsg]=useState('')
  const [history,setHistory] = useState([])
  const [historyLoading,setHistoryLoading] = useState(false)
  const [historyError,setHistoryError] = useState('')

  async function load(){
    try{
      const r=await fetch(`${API}/public/bulletin`)
      const j=await r.json(); setCurrent(String(j.text||''))
    }catch{ setCurrent('') }
  }
  async function loadHistory(){
    setHistoryLoading(true)
    setHistoryError('')
    try{
      const res = await fetch(`${API}/admin/bulletin/log`, {
        headers:{'Authorization':'Bearer '+token}
      })
      if(!res.ok){
        let errMsg = 'Failed to load bulletin history'
        try{
          const j = await res.json()
          errMsg = j?.error || errMsg
        }catch(_){ }
        throw new Error(errMsg)
      }
      const data = await res.json()
      setHistory(Array.isArray(data)? data : [])
    }catch(e){
      setHistory([])
      setHistoryError(String(e.message||e))
    }finally{
      setHistoryLoading(false)
    }
  }
  useEffect(()=>{ load() },[])
  useEffect(()=>{ if(token) loadHistory() },[token])

  async function publish(){
    setMsg('Publishing…')
    const r=await fetch(`${API}/admin/bulletin/save`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({ text })
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Published'); setText(''); load(); loadHistory()
  }

  async function remove(){
    if(!confirm('Remove current bulletin?')) return
    // No JSON body needed; avoid sending Content-Type without a body to prevent 400
    const r=await fetch(`${API}/admin/bulletin/remove`,{
      method:'POST', headers:{'Authorization':'Bearer '+token}
    })
    const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
    setMsg('Removed'); load(); loadHistory()
  }

  const sortedHistory = useMemo(()=>[
    ...history
  ].sort((a,b)=> new Date(b.published_at).getTime() - new Date(a.published_at).getTime()), [history])

  return (
    <div>
      <details style={{marginBottom:24}}>
        <summary style={{cursor:'pointer',fontWeight:600}}>Bulletin controls</summary>
        <div style={{marginTop:12}}>
          <p className="muted">Current: {current? current : 'All systems are operational.'}</p>
          <div style={{display:'grid',gap:8,alignItems:'start'}}>
            <textarea rows={3} value={text} onChange={e=>setText(e.target.value)} placeholder="Type new bulletin message…"/>
            <div style={{display:'flex',gap:8}}>
              <button onClick={publish} disabled={!text.trim()}>Publish</button>
              <button onClick={remove}>Remove</button>
              <span style={{color:'#6b7280'}}>{msg}</span>
            </div>
          </div>
        </div>
      </details>
      <details>
        <summary style={{cursor:'pointer',fontWeight:600}}>Bulletin history</summary>
        <div style={{marginTop:12}}>
          {historyLoading && <p>Loading history…</p>}
          {historyError && !historyLoading && <p className="error">{historyError}</p>}
          {!historyLoading && !historyError && (
            sortedHistory.length === 0 ? (
              <p className="muted">No bulletin activity recorded yet.</p>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{minWidth:200}}>Message</th>
                      <th style={{minWidth:180}}>Published</th>
                      <th style={{minWidth:180}}>Removed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistory.map((entry, idx)=>{
                      const pubAt = entry.published_at ? new Date(entry.published_at).toLocaleString() : '—'
                      const pubBy = entry.published_by_name || entry.published_by || '—'
                      const removedAt = entry.removed_at ? new Date(entry.removed_at).toLocaleString() : null
                      const removedBy = entry.removed_by_name || entry.removed_by || ''
                      let removalNote = ''
                      if(!removedAt){
                        removalNote = 'Active'
                      }else if(entry.removal_action === 'SUPERSEDED'){
                        removalNote = `Superseded by ${removedBy || 'next bulletin'}`
                      }else{
                        removalNote = removedBy ? `Removed by ${removedBy}` : 'Removed'
                      }
                      return (
                        <tr key={idx}>
                          <td style={{whiteSpace:'pre-wrap'}}>{entry.text || <span className="muted">(empty)</span>}</td>
                          <td>
                            <div>{pubAt}</div>
                            <div className="muted">{pubBy}</div>
                          </td>
                          <td>
                            {removedAt ? (
                              <>
                                <div>{removedAt}</div>
                                <div className="muted">{removalNote}</div>
                              </>
                            ) : (
                              <span className="muted">{removalNote}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </details>
    </div>
  )
}
