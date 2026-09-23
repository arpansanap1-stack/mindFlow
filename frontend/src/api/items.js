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

export async function fetchItems(status = 'inbox') {
  const url = status ? `${API_BASE}/items?status=${encodeURIComponent(status)}` : `${API_BASE}/items`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to fetch items');
}

export async function createItem(rawText, extraFields = {}) {
  const res = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ raw_text: rawText, ...extraFields }),
  });
  return handleResponse(res, 'Failed to create item');
}

export async function updateItem(id, updates) {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(updates),
  });
  return handleResponse(res, 'Failed to update item');
}

export async function deleteItem(id) {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to delete item');
}

export async function completeItem(id, actualDuration = null) {
  const payload = actualDuration !== null && actualDuration !== undefined && actualDuration !== ''
    ? { actual_duration: Number(actualDuration) }
    : {};
  const res = await fetch(`${API_BASE}/items/${id}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to complete item');
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
