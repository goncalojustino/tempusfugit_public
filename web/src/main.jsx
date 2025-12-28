import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import './styles/base.css'
import './styles/components.css'

const el = document.getElementById('root')
if (!el) throw new Error('#root not found')
createRoot(el).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)
