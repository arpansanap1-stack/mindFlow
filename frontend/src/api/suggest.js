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
  return res.json();
}

export async function fetchNowSuggestion(isoNow = null) {
  const url = isoNow
    ? `${API_BASE}/suggest/now?now=${encodeURIComponent(isoNow)}`
    : `${API_BASE}/suggest/now`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  return handleResponse(res, 'Failed to fetch suggestion');
}

export async function recordSuggestionAction(itemId, action) {
  const res = await fetch(`${API_BASE}/suggest/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ item_id: itemId, action }),
  });
  return handleResponse(res, 'Failed to record suggestion action');
}
