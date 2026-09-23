import { getAuthHeaders, notifyUnauthorized } from './auth';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function handleResponse(res, fallbackMessage) {
  if (res.status === 401) {
    notifyUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `${fallbackMessage} (${res.status})`);
  }
  if (res.status === 204) {
    return true;
  }
  return res.json();
}

export async function fetchRoutineBlocks(dayOfWeek = null) {
  const url = dayOfWeek !== null && dayOfWeek !== undefined
    ? `${API_BASE}/routine?day_of_week=${dayOfWeek}`
    : `${API_BASE}/routine`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  return handleResponse(res, 'Failed to fetch routine blocks');
}

export async function createRoutineBlock(payload) {
  const res = await fetch(`${API_BASE}/routine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to add routine block');
}

export async function updateRoutineBlock(id, updates) {
  const res = await fetch(`${API_BASE}/routine/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(updates),
  });
  return handleResponse(res, 'Failed to update routine block');
}

export async function deleteRoutineBlock(id) {
  const res = await fetch(`${API_BASE}/routine/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to delete routine block');
}

export async function fetchUserPrefs() {
  const res = await fetch(`${API_BASE}/prefs`, { headers: getAuthHeaders() });
  return handleResponse(res, 'Failed to fetch user preferences');
}

export async function updateUserPrefs(payload) {
  const res = await fetch(`${API_BASE}/prefs`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to update user preferences');
}
