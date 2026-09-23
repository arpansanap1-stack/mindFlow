const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function fetchSchedule(dateStr = null) {
  const url = dateStr ? `${API_BASE}/schedule?date=${encodeURIComponent(dateStr)}` : `${API_BASE}/schedule`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch schedule (${res.status})`);
  }
  return res.json();
}

export async function runScheduler(dateStr = null) {
  const payload = dateStr ? { date: dateStr } : {};
  const res = await fetch(`${API_BASE}/schedule/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to run scheduler (${res.status})`);
  }
  return res.json();
}

