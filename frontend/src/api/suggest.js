const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function fetchNowSuggestion(isoNow = null) {
  const url = isoNow
    ? `${API_BASE}/suggest/now?now=${encodeURIComponent(isoNow)}`
    : `${API_BASE}/suggest/now`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch suggestion (${res.status})`);
  }
  return res.json();
}

export async function recordSuggestionAction(itemId, action) {
  const res = await fetch(`${API_BASE}/suggest/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId, action }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to record suggestion action (${res.status})`);
  }
  return res.json();
}

