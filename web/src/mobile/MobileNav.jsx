import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function MobileNav({ title='Tempusfugit', onSwitchDesktop, role }){
  const [open,setOpen]=useState(false)
  const nav = useNavigate()
  function goDesktop(){ localStorage.setItem('tf_view','desktop'); if(typeof onSwitchDesktop==='function') onSwitchDesktop(); else nav('/login') }
  return (
    <>
      <div className="nav" style={{display:'flex',alignItems:'center',gap:12}}>
        <button className="hamburger" aria-label="Menu" onClick={()=>setOpen(true)}>
          <span></span><span></span><span></span>
        </button>
        <em style={{fontWeight:700}}>{title}</em>
        <span className="spacer" />
        <button className="btn secondary hide-xs" onClick={goDesktop}>Desktop</button>
      </div>
      {open && (
        <>
          <div className="drawer-backdrop" onClick={()=>setOpen(false)} />
          <div className="drawer drawer-left" style={{left:0, right:'auto', boxShadow:'8px 0 20px rgba(0,0,0,0.2)'}}>
            <header>Menu</header>
            <nav>
              <Link to="/mobile/home" onClick={()=>setOpen(false)}>Home</Link>
              <Link to="/mobile/grid" onClick={()=>setOpen(false)}>Book</Link>
              <Link to="/mobile/my" onClick={()=>setOpen(false)}>My bookings</Link>
              <Link to="/mobile/account" onClick={()=>setOpen(false)}>Account</Link>
              <Link to="/mobile/display" onClick={()=>setOpen(false)}>Current usage</Link>
              <button onClick={()=>{ setOpen(false); goDesktop() }}>Switch to desktop</button>
            </nav>
          </div>
        </>
      )}
    </>
  )
}
