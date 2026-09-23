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

export async function fetchFeedbackStats() {
  const res = await fetch(`${API_BASE}/feedback/stats`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to fetch feedback stats');
}

export async function recalibrateMultipliers(minSamples = 5) {
  const res = await fetch(`${API_BASE}/feedback/recalibrate?min_samples=${minSamples}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to recalibrate multipliers');
}
