const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('account cache and async profile loading preserve current session and newer saved appearance', async t => {
  const globals = ['window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent', 'fetch'];
  const previous = Object.fromEntries(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = () => {
    const entries = new Map();
    return { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  };
  const root = { dataset: {}, style: {} };
  const events = [];
  Object.assign(globalThis, {
    document: { documentElement: root }, localStorage: storage(), sessionStorage: storage(),
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), dispatchEvent: event => events.push(event) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  });
  t.after(() => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const source = fs.readFileSync(path.resolve(__dirname, '../../Frontend/client/src/lib/profile.js'), 'utf8').replace(/^import .*;\n/gm, '');
  const client = await import(`data:text/javascript;base64,${Buffer.from(`const API_URL = 'http://profile-test.invalid';\n${source}`).toString('base64')}`);
  const tokenFor = id => `test.${Buffer.from(JSON.stringify({ id })).toString('base64url')}.signature`;
  const accountA = { _id: 'account-a', username: 'member_a', preferences: { theme: 'dim', textSize: 'large', reducedMotion: true } };
  sessionStorage.setItem('token', tokenFor(accountA._id));
  client.cacheProfile(accountA);
  assert.equal(root.dataset.theme, 'dim');
  assert.equal(root.style.fontSize, '18px');
  assert.equal(events.at(-1).type, 'dailycollabs:profile');
  assert.equal(client.readCachedProfile().username, 'member_a');

  sessionStorage.setItem('token', tokenFor('account-b'));
  client.initializeAppearance();
  assert.equal(client.readCachedProfile(), null);
  assert.equal(root.dataset.theme, 'dark');

  sessionStorage.setItem('token', tokenFor(accountA._id));
  let resolveResponse;
  globalThis.fetch = () => new Promise(resolve => { resolveResponse = resolve; });
  const pending = client.loadProfile();
  const saved = { ...accountA, username: 'updated_name', preferences: { theme: 'light', textSize: 'default', reducedMotion: false } };
  localStorage.setItem = () => { throw new Error('Storage quota exceeded'); };
  client.cacheProfile(saved);
  resolveResponse({ ok: true, json: async () => accountA });
  assert.equal((await pending).username, 'updated_name');
  assert.equal(client.readCachedProfile().username, 'updated_name');
  assert.equal(root.dataset.theme, 'light');

  const pendingAfterLogout = client.loadProfile();
  sessionStorage.removeItem('token');
  client.initializeAppearance();
  resolveResponse({ ok: true, json: async () => saved });
  assert.equal(await pendingAfterLogout, null);
  assert.equal(root.dataset.theme, 'dark');
});
