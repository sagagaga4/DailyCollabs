import { API_URL } from '../../config';

export function normalizeFeedPreferences(input = {}) {
  return {
    personalized: input.personalized !== false,
    mode: ['balanced', 'fresh', 'discover', 'following'].includes(input.mode) ? input.mode : 'balanced',
    freshness: Number.isFinite(input.freshness) ? Math.max(0, Math.min(1, input.freshness)) : 0.5,
    diversity: Number.isFinite(input.diversity) ? Math.max(0, Math.min(1, input.diversity)) : 0.5,
    followedTopics: Array.isArray(input.followedTopics) ? input.followedTopics.filter(topic => typeof topic === 'string').slice(0, 30) : [],
    mutedTopics: Array.isArray(input.mutedTopics) ? input.mutedTopics.filter(topic => typeof topic === 'string').slice(0, 20) : [],
  };
}

export async function feedRequest(path, options = {}) {
  const token = sessionStorage.getItem('token');
  if (!token) throw new Error('Sign in to tune your feed.');
  const response = await fetch(`${API_URL}/feed${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (sessionStorage.getItem('token') !== token) throw new Error('Your account changed. Open feed controls again.');
  if (!response.ok) throw new Error(data.message || data.error || 'Your feed preferences could not be saved.');
  if (!data.preferences || typeof data.preferences !== 'object') throw new Error('We could not read your feed preferences. Please try again.');
  return { ...data, preferences: normalizeFeedPreferences(data.preferences), interests: Array.isArray(data.interests) ? data.interests.filter(item => typeof item?.topic === 'string') : [], signalsCount: Number.isFinite(data.signalsCount) ? data.signalsCount : 0 };
}
