const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function fetchItems(status = 'inbox') {
  const url = status ? `${API_BASE}/items?status=${encodeURIComponent(status)}` : `${API_BASE}/items`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch items (${res.status})`);
  }
  return res.json();
}

export async function createItem(rawText, extraFields = {}) {
  const res = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: rawText, ...extraFields }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create item (${res.status})`);
  }
  return res.json();
}

export async function updateItem(id, updates) {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update item (${res.status})`);
  }
  return res.json();
}

export async function deleteItem(id) {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete item (${res.status})`);
  }
  return true;
}

export async function completeItem(id, actualDuration = null) {
  const payload = actualDuration !== null && actualDuration !== undefined && actualDuration !== ''
    ? { actual_duration: Number(actualDuration) }
    : {};
  const res = await fetch(`${API_BASE}/items/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to complete item (${res.status})`);
  }
  return res.json();
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.ok;
}

