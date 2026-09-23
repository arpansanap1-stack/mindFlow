const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'mindflow_token';

let unauthorizedListeners = [];

export function onUnauthorized(callback) {
  unauthorizedListeners.push(callback);
  return () => {
    unauthorizedListeners = unauthorizedListeners.filter((cb) => cb !== callback);
  };
}

export function notifyUnauthorized() {
  clearToken();
  unauthorizedListeners.forEach((cb) => cb());
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let errorDetail = 'Invalid email or password';
    try {
      const data = await res.json();
      errorDetail = data.detail || errorDetail;
    } catch {}
    throw new Error(errorDetail);
  }

  const data = await res.json();
  if (data.access_token) {
    setToken(data.access_token);
  }
  return data;
}

export async function getMe() {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/auth/me`, { headers });

  if (res.status === 401 || res.status === 403) {
    notifyUnauthorized();
    throw new Error('Authentication required');
  }

  if (!res.ok) {
    throw new Error('Failed to fetch user profile');
  }

  return await res.json();
}

export async function changePassword(currentPassword, newPassword) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };

  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });

  if (!res.ok) {
    let err = 'Failed to change password';
    try {
      const data = await res.json();
      err = data.detail || err;
    } catch {}
    throw new Error(err);
  }

  return await res.json();
}

export async function logout() {
  try {
    const headers = getAuthHeaders();
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers,
    });
  } catch (err) {
    console.warn('Logout network error:', err);
  } finally {
    clearToken();
  }
}

