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

export async function fetchSchedule(dateStr = null) {
  const url = dateStr ? `${API_BASE}/schedule?date=${encodeURIComponent(dateStr)}` : `${API_BASE}/schedule`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  return handleResponse(res, 'Failed to fetch schedule');
}

export async function runScheduler(dateStr = null) {
  const payload = {
    current_time: new Date().toISOString(),
    ...(dateStr ? { date: dateStr } : {}),
  };

  const res = await fetch(`${API_BASE}/schedule/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to run scheduler');
}
