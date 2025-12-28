import { createContext, useContext } from 'react';

const API = import.meta.env.VITE_API_URL || '/api';

async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_err) {
    return { raw: text };
  }
}

async function impersonate(email) {
  const token = localStorage.getItem('tf_token');
  if (!token) {
    throw new Error('NOT SIGNED IN');
  }
  const res = await fetch(`${API}/admin/impersonate/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email }),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const detail = data?.error || data?.raw || 'FAILED TO START IMPERSONATION';
    throw new Error(detail);
  }
  if (!data?.token) {
    throw new Error('MISSING TOKEN FROM RESPONSE');
  }

  if (!localStorage.getItem('tf_token_original')) {
    localStorage.setItem('tf_token_original', token);
    const currentRole = localStorage.getItem('tf_role');
    if (currentRole) {
      localStorage.setItem('tf_role_original', currentRole);
    }
    const currentEmail = localStorage.getItem('tf_email');
    if (currentEmail) {
      localStorage.setItem('tf_email_original', currentEmail);
    }
  }

  localStorage.setItem('tf_token', data.token);
  if (data.role) {
    localStorage.setItem('tf_role', data.role);
  }
  if (data.email) {
    localStorage.setItem('tf_email', data.email);
  }
  if (data.impersonator) {
    localStorage.setItem('tf_impersonator', data.impersonator);
  }
  window.location.reload();
  return data;
}

async function stopImpersonating() {
  const token = localStorage.getItem('tf_token');
  if (!token) {
    throw new Error('NOT SIGNED IN');
  }
  const res = await fetch(`${API}/admin/impersonate/stop`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const detail = data?.error || data?.raw || 'FAILED TO STOP IMPERSONATION';
    throw new Error(detail);
  }

  const originalToken = localStorage.getItem('tf_token_original');
  const originalRole = localStorage.getItem('tf_role_original');
  const originalEmail = localStorage.getItem('tf_email_original');

  if (originalToken) {
    localStorage.setItem('tf_token', originalToken);
  } else {
    localStorage.removeItem('tf_token');
  }
  if (originalRole) {
    localStorage.setItem('tf_role', originalRole);
  } else {
    localStorage.removeItem('tf_role');
  }
  if (originalEmail) {
    localStorage.setItem('tf_email', originalEmail);
  } else {
    localStorage.removeItem('tf_email');
  }

  localStorage.removeItem('tf_token_original');
  localStorage.removeItem('tf_role_original');
  localStorage.removeItem('tf_email_original');
  localStorage.removeItem('tf_impersonator');

  window.location.reload();
  return data;
}

const helpers = {
  impersonate,
  stopImpersonating,
  isImpersonating: () => Boolean(localStorage.getItem('tf_impersonator')),
  getImpersonator: () => localStorage.getItem('tf_impersonator'),
};

export const AuthContext = createContext(helpers);

export function AuthProvider({ children, value }) {
  return (
    <AuthContext.Provider value={value || helpers}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
