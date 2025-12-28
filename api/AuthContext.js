import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonator, setImpersonator] = useState(null);

  const parseJwt = (token) => {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        setUser(decoded);
        if (decoded.impersonator) {
          setImpersonator(localStorage.getItem('impersonator'));
        }
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('impersonator');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, passcode) => {
    const { data } = await api.post('/auth/login', { email, passcode });
    localStorage.setItem('token', data.token);
    const decoded = parseJwt(data.token);
    setUser(decoded);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('impersonator');
    localStorage.removeItem('original_token');
    setUser(null);
    setImpersonator(null);
    window.location.href = '/login';
  };

  const impersonate = async (email) => {
    const { data } = await api.post('/admin/impersonate/start', { email });
    const originalToken = localStorage.getItem('token');
    
    localStorage.setItem('original_token', originalToken);
    localStorage.setItem('token', data.token);
    localStorage.setItem('impersonator', data.impersonator);

    window.location.reload();
  };

  const stopImpersonating = async () => {
    await api.post('/admin/impersonate/stop');
    const originalToken = localStorage.getItem('original_token');
    localStorage.setItem('token', originalToken);
    localStorage.removeItem('original_token');
    localStorage.removeItem('impersonator');
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, impersonate, stopImpersonating, impersonator }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};