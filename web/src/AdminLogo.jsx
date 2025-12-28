import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || '/api'

function NavbarLogo({ token }){
  const [preview,setPreview]=useState('')
  const [msg,setMsg]=useState('')
  const [size,setSize]=useState('')

  useEffect(()=>{
    // Use timestamp to bust cache on load
    setPreview(`${API}/public/logo?ts=${Date.now()}`)
  },[])

  async function onPick(e){
    const file = e.target.files?.[0]
    if(!file) return
    setMsg('Reading…'); setSize('')
    const arr = await file.arrayBuffer()
    const b64 = btoa(String.fromCharCode(...new Uint8Array(arr)))
    setSize(`${(file.size/1024).toFixed(1)} kB`)
    try{
      setMsg('Uploading…')
      const r = await fetch(`${API}/admin/settings/logo`,{
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({ data: b64, type: file.type||'image/png' })
      })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
      setMsg('Uploaded')
      setPreview(`${API}/public/logo?ts=${Date.now()}`)
    }catch{ setMsg('Upload failed') }
  }

  async function removeLogo(){
    if(!confirm('Are you sure you want to remove the navbar logo?')) return
    setMsg('Removing…')
    try{
      const r = await fetch(`${API}/admin/settings/logo/delete`,{ method:'POST', headers:{'Authorization':'Bearer '+token} })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
      setMsg('Removed')
      setPreview('')
    }catch{ setMsg('Removal failed') }
  }

  return (
    <div style={{marginTop:12}}>
      <h3>Logo - navbar</h3>
      <p className="muted" style={{marginTop:-8}}>Shown on the black navbar. Recommended height ~32–40px. For best results, use a logo with a transparent or black background.</p>
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'grid',placeItems:'center',width:220,height:56,background:'#000',border:'1px solid #e5e7eb',borderRadius:8}}>
          {preview ? <img src={preview} alt="logo preview" style={{maxHeight:40, maxWidth:200, objectFit:'contain'}} onError={()=>setPreview('')}/> : <span className="muted">No logo</span>}
        </div>
        <input type="file" accept="image/*" onChange={onPick}/>
        <button className="btn secondary" onClick={removeLogo} disabled={!preview}>Remove</button>
        <span className="muted">{size}</span>
        <span className="muted">{msg}</span>
      </div>
    </div>
  )
}

function FrontpageLogo({ token }){
  const [preview,setPreview]=useState('')
  const [msg,setMsg]=useState('')
  const [size,setSize]=useState('')

  useEffect(()=>{
    setPreview(`${API}/public/logo_frontpage?ts=${Date.now()}`)
  },[])

  async function onPick(e){
    const file = e.target.files?.[0]
    if(!file) return
    setMsg('Reading…'); setSize('')
    const arr = await file.arrayBuffer()
    const b64 = btoa(String.fromCharCode(...new Uint8Array(arr)))
    setSize(`${(file.size/1024).toFixed(1)} kB`)
    try{
      setMsg('Uploading…')
      const r = await fetch(`${API}/admin/settings/logo_frontpage`,{
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({ data: b64, type: file.type||'image/png' })
      })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
      setMsg('Uploaded')
      setPreview(`${API}/public/logo_frontpage?ts=${Date.now()}`)
    }catch{ setMsg('Upload failed') }
  }

  async function removeLogo(){
    if(!confirm('Are you sure you want to remove the front page logo?')) return
    setMsg('Removing…')
    try{
      const r = await fetch(`${API}/admin/settings/logo_frontpage/delete`,{ method:'POST', headers:{'Authorization':'Bearer '+token} })
      const j=await r.json(); if(!r.ok){ setMsg(j.error||'ERROR'); return }
      setMsg('Removed')
      setPreview('')
    }catch{ setMsg('Removal failed') }
  }

  return (
    <div style={{marginTop:24}}>
      <h3>Logo - frontpage</h3>
      <p className="muted" style={{marginTop:-8}}>Shown on the login page. The provided image has a white background.</p>
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'grid',placeItems:'center',width:220,height:120,background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:8}}>
          {preview ? <img src={preview} alt="logo preview" style={{maxHeight:100, maxWidth:200, objectFit:'contain'}} onError={()=>setPreview('')}/> : <span className="muted">No logo</span>}
        </div>
        <input type="file" accept="image/*" onChange={onPick}/>
        <button className="btn secondary" onClick={removeLogo} disabled={!preview}>Remove</button>
        <span className="muted">{size}</span>
        <span className="muted">{msg}</span>
      </div>
    </div>
  )
}

export default function AdminLogo({ token }){
  return (
    <>
      <NavbarLogo token={token} />
      <FrontpageLogo token={token} />
    </>
  )
}
