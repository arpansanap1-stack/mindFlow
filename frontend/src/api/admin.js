import { getAuthHeaders, notifyUnauthorized } from './auth';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function handleResponse(res) {
  if (res.status === 401) {
    notifyUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }
  if (res.status === 403) {
    throw new Error('Access denied. Administrator privileges required.');
  }
  if (!res.ok) {
    let errorDetail = 'Operation failed';
    try {
      const data = await res.json();
      errorDetail = data.detail || errorDetail;
    } catch {}
    throw new Error(errorDetail);
  }
  if (res.status === 204) {
    return true;
  }
  return await res.json();
}

export async function fetchUsers(search = '', role = '', status = '') {
  const params = new URLSearchParams();
  if (search) params.append('query', search);
  if (role) params.append('role', role);
  if (status) params.append('status', status);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/admin/users${qs}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

export async function createUser({ email, role = 'USER', temporaryPassword = '' }) {
  const payload = {
    email: email.trim(),
    role,
  };
  if (temporaryPassword && temporaryPassword.trim()) {
    payload.temporary_password = temporaryPassword.trim();
  }

  const res = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateUserStatus(userId, status) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
}

export async function resetUserPassword(userId, newPassword = '') {
  const payload = {};
  if (newPassword && newPassword.trim()) {
    payload.new_password = newPassword.trim();
  }

  const res = await fetch(`${API_BASE}/admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteUser(userId) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

