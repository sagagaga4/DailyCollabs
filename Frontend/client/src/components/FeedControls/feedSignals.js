import { API_URL } from '../../config';

export function signalText(value, max) {
  if (typeof value !== 'string') return '';
  return [...value.normalize('NFKC')].map(character => {
    const point = character.codePointAt(0);
    return point < 32 || point === 127 || (point >= 8234 && point <= 8238) || (point >= 8294 && point <= 8297) ? ' ' : character;
  }).join('').replace(/\s+/gu, ' ').trim().slice(0, max);
}

async function requestSignal(type, { url, title, query } = {}, options = {}, token) {
  const body = type === 'search' ? { type, query: signalText(query, 200) } : { type, url, title: signalText(title, 300) };
  const response = await fetch(`${API_URL}/feed/signals`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body), signal: options.signal, keepalive: type === 'open',
  });
  const data = await response.json().catch(() => ({}));
  if (sessionStorage.getItem('token') !== token) throw new Error('Your session changed. Open your feed again.');
  if (!response.ok) throw new Error(data.message || data.error || 'Your feed feedback could not be saved.');
  return data;
}

const searchQueues = new Map();
export function waitForSearchSignals() {
  return (searchQueues.get(sessionStorage.getItem('token')) || Promise.resolve()).catch(() => {});
}
/** Called only for a deliberate search, open, or explicit feedback action. */
export function sendFeedSignal(type, metadata = {}, options = {}) {
  const token = sessionStorage.getItem('token');
  if (!token) return Promise.resolve({ recorded: false });
  if (type !== 'search') return requestSignal(type, metadata, options, token);
  // Search writes must reach the server in submission order. Cancelling a UI
  // lookup does not cancel the user's already-submitted learning signal.
  const previous = searchQueues.get(token) || Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    if (sessionStorage.getItem('token') !== token) throw new Error('Your session changed. Open your feed again.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try { return await requestSignal(type, metadata, { signal: controller.signal }, token); }
    finally { clearTimeout(timeout); }
  });
  searchQueues.set(token, pending);
  const cleanup = () => { if (searchQueues.get(token) === pending) searchQueues.delete(token); };
  pending.then(cleanup, cleanup);
  return pending;
}
