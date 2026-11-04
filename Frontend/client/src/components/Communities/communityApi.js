import { API_URL } from '../../config';

export async function communityRequest(path = '', options = {}) {
  const token = sessionStorage.getItem('token');
  const response = await fetch(`${API_URL}/communities${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Unable to load this community. Please try again.');
  return data;
}
