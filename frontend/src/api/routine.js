const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function fetchRoutineBlocks(dayOfWeek = null) {
  const url = dayOfWeek !== null && dayOfWeek !== undefined
    ? `${API_BASE}/routine?day_of_week=${dayOfWeek}`
    : `${API_BASE}/routine`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch routine blocks (${res.status})`);
  }
  return res.json();
}

export async function createRoutineBlock(payload) {
  const res = await fetch(`${API_BASE}/routine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to add routine block (${res.status})`);
  }
  return res.json();
}

export async function updateRoutineBlock(id, updates) {
  const res = await fetch(`${API_BASE}/routine/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update routine block (${res.status})`);
  }
  return res.json();
}

export async function deleteRoutineBlock(id) {
  const res = await fetch(`${API_BASE}/routine/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete routine block (${res.status})`);
  }
  return true;
}

export async function fetchUserPrefs() {
  const res = await fetch(`${API_BASE}/prefs`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch user preferences (${res.status})`);
  }
  return res.json();
}

export async function updateUserPrefs(payload) {
  const res = await fetch(`${API_BASE}/prefs`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update user preferences (${res.status})`);
  }
  return res.json();
}

