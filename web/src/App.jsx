import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login.jsx'
import Home from './Home.jsx'
import Grid from './Grid.jsx'
import My from './My.jsx'
import Admin from './Admin.jsx'
import Display from './Display.jsx'
import Account from './Account.jsx'
import AppMobile from './mobile/AppMobile.jsx'
import Register from './Register.jsx'
import Reset from './Reset.jsx'

export default function App(){
  const [token,setToken] = useState(localStorage.getItem('tf_token')||'')
  const [role,setRole]   = useState(localStorage.getItem('tf_role')||'')
  const [email,setEmail] = useState(localStorage.getItem('tf_email')||'')
  const [idleTs,setIdleTs] = useState(Date.now())

  useEffect(()=>{
    if (token) { localStorage.setItem('tf_token', token) }
    else { localStorage.removeItem('tf_token') }
  },[token])
  useEffect(()=>{
    if (role) localStorage.setItem('tf_role', role); else localStorage.removeItem('tf_role')
    if (email) localStorage.setItem('tf_email', email); else localStorage.removeItem('tf_email')
  },[role,email])

  function onLogout(){
    setToken(''); setRole(''); setEmail('')
  }

  // Auto-logout after 10 minutes of no activity
  useEffect(()=>{
    if(!token) return
    let timer = null
    const reset = ()=>{
      setIdleTs(Date.now())
      if(timer) clearTimeout(timer)
      timer = setTimeout(()=>{
        // Clear auth to force relogin
        setToken(''); setRole(''); setEmail('')
      }, 10*60*1000)
    }
    const events = ['mousemove','keydown','click','scroll','touchstart','touchmove']
    events.forEach(ev=> window.addEventListener(ev, reset, { passive:true }))
    reset()
    return ()=>{ events.forEach(ev=> window.removeEventListener(ev, reset)); if(timer) clearTimeout(timer) }
  },[token])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          <Login token={token} setToken={setToken} role={role} setRole={setRole} email={email} setEmail={setEmail}/>
        }/>
        <Route path="/" element={
          token ? <Home token={token} role={role} email={email} onLogout={onLogout}/> : <Navigate to="/login" replace/>
        }/>
        <Route path="/grid" element={
          token ? <Grid token={token} role={role} email={email} onLogout={onLogout}/> : <Navigate to="/login" replace/>
        }/>
        <Route path="/my" element={
          token ? <My token={token} role={role} email={email} onLogout={onLogout}/> : <Navigate to="/login" replace/>
        }/>
        <Route path="/admin" element={
          token && ['STAFF','DANTE'].includes(role)
            ? <Admin token={token} role={role} email={email} onLogout={onLogout}/>
            : <Navigate to="/login" replace/>
        }/>
        <Route path="/display" element={<Display/>}/>
        <Route path="/account" element={
          token ? <Account token={token} role={role} email={email} onLogout={onLogout}/> : <Navigate to="/login" replace/>
        }/>
        <Route path="/mobile/*" element={<AppMobile/>}/>
        <Route path="/m/*" element={<AppMobile/>}/>
        <Route path="/register" element={<Register/>}/>
        <Route path="/reset" element={<Reset/>}/>
        <Route path="*" element={<Navigate to={token?'/':'/login'} replace/>}/>
      </Routes>
    </BrowserRouter>
  )
}
