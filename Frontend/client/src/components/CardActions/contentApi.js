import { API_URL } from '../../config';

export async function contentRequest(path, options = {}) {
  const token = sessionStorage.getItem('token');
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || 'Could not complete that action.');
  return data;
}
