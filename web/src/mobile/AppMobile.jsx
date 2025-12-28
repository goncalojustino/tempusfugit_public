import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import MobileLogin from './LoginMobile.jsx'
import MobileHome from './HomeMobile.jsx'
import MobileGrid from './GridMobile.jsx'
import MobileMy from './MyMobile.jsx'
import MobileAccount from './AccountMobile.jsx'
import MobileDisplay from './DisplayMobile.jsx'

export default function AppMobile(){
  const [token,setToken] = useState(localStorage.getItem('tf_token')||'')
  const [role,setRole]   = useState(localStorage.getItem('tf_role')||'')
  const [email,setEmail] = useState(localStorage.getItem('tf_email')||'')
  const nav = useNavigate()

  useEffect(()=>{ localStorage.setItem('tf_view','mobile') },[])
  useEffect(()=>{ if (token) localStorage.setItem('tf_token', token); else localStorage.removeItem('tf_token') },[token])
  useEffect(()=>{ if (role) localStorage.setItem('tf_role', role); else localStorage.removeItem('tf_role'); if (email) localStorage.setItem('tf_email', email); else localStorage.removeItem('tf_email') },[role,email])

  useEffect(()=>{
    if(!token) return
    let timer = null
    const reset = () => {
      if(timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setToken('')
        setRole('')
        setEmail('')
        nav('/mobile/login', { replace:true })
      }, 10 * 60 * 1000)
    }
    const events = ['mousemove','keydown','click','scroll','touchstart','touchmove']
    events.forEach(ev => window.addEventListener(ev, reset, { passive:true }))
    reset()
    return () => {
      events.forEach(ev => window.removeEventListener(ev, reset))
      if(timer) clearTimeout(timer)
    }
  },[token, nav])

  function onLogout(){ setToken(''); setRole(''); setEmail(''); nav('/mobile/login',{replace:true}) }

  return (
    <Routes>
      <Route path="/login" element={<MobileLogin token={token} setToken={setToken} role={role} setRole={setRole} email={email} setEmail={setEmail}/>}/>
      <Route path="/home"  element={token ? <MobileHome token={token} role={role} email={email} onLogout={onLogout}/> : <Navigate to="/mobile/login" replace/>}/>
      <Route path="/grid"  element={token ? <MobileGrid token={token} role={role} email={email} onLogout={onLogout}/> : <Navigate to="/mobile/login" replace/>}/>
      <Route path="/my"    element={token ? <MobileMy token={token} role={role} email={email} onLogout={onLogout}/> : <Navigate to="/mobile/login" replace/>}/>
      <Route path="/account" element={token ? <MobileAccount token={token} role={role} email={email} onLogout={onLogout}/> : <Navigate to="/mobile/login" replace/>}/>
      <Route path="/display" element={<MobileDisplay/>}/>
      <Route path="*" element={<Navigate to={token?'/mobile/home':'/mobile/login'} replace/>}/>
    </Routes>
  )
}
