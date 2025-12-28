import React, { useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

export default function AdminBroadcast({ token }){
  const [subject, setSubject] = useState('<CHANGE:mail_subject> ')
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')

  async function sendAll(e){
    e.preventDefault()
    if(!subject.trim() || !text.trim()) { setMsg('Subject and message are required.'); return }
    setMsg('Sending…')
    try{
      const r = await fetch(`${API}/admin/notify/all`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
        body: JSON.stringify({ subject: subject.trim(), text: text.trim() })
      })
      const j = await r.json()
      if(!r.ok) { setMsg(j.error || 'Failed to send'); return }
      setMsg(`Sent to ${j.recipients} recipients.`)
      setSubject(''); setText('')
    }catch(err){ setMsg(String(err.message||err)) }
  }

  return (
    <div>
      <h3>Broadcast Email</h3>
      <p className="muted">Send an email to all users (BCC).</p>
      <p className="muted">{msg}</p>
      <form onSubmit={sendAll} className="toolbar" style={{alignItems:'stretch'}}>
        <input className="input" placeholder="Subject" value={subject} onChange={e=>setSubject(e.target.value)} style={{minWidth:280}}/>
        <textarea className="input" placeholder="Message" value={text} onChange={e=>setText(e.target.value)} rows={4} style={{flex:1, resize:'vertical'}}/>
        <button className="btn" type="submit" disabled={!subject.trim() || !text.trim()}>Send</button>
      </form>
    </div>
  )
}
