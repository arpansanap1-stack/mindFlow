const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function fetchFeedbackStats() {
  const res = await fetch(`${API_BASE}/feedback/stats`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch feedback stats (${res.status})`);
  }
  return res.json();
}

export async function recalibrateMultipliers(minSamples = 5) {
  const res = await fetch(`${API_BASE}/feedback/recalibrate?min_samples=${minSamples}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to recalibrate multipliers (${res.status})`);
  }
  return res.json();
}

