const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const frontendRoot = path.resolve(__dirname, '../../Frontend/client');
const frontendRequire = createRequire(path.join(frontendRoot, 'package.json'));
const esbuild = frontendRequire('esbuild');
function compile(filename, globals = {}) {
  const output = esbuild.buildSync({ entryPoints: [path.join(frontendRoot, filename)], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react'], define: { 'import.meta.env.VITE_API_URL': '"https://feed-controls.test"' } });
  const module = { exports: {} };
  vm.runInNewContext(output.outputFiles[0].text, { module, exports: module.exports, require: frontendRequire, ...globals });
  return module.exports;
}

test('feed controls keep preference fields explicit and normalize malformed numeric data', () => {
  const { normalizeFeedPreferences } = compile('src/components/FeedControls/feedApi.js');
  const preferences = normalizeFeedPreferences({ personalized: false, mode: 'discover', freshness: 2, diversity: NaN, followedTopics: ['חלל', 'technology'], mutedTopics: ['spoilers'], ownerId: 'forged' });
  assert.equal(preferences.personalized, false);
  assert.equal(preferences.mode, 'discover');
  assert.equal(preferences.freshness, 1);
  assert.equal(preferences.diversity, 0.5);
  assert.equal(preferences.ownerId, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(preferences.followedTopics)), ['חלל','technology']);
});

test('feed API requests authenticate, retain server feedback, and reject stale account responses', async () => {
  let token = null;
  let calls = [];
  let resolve;
  const { feedRequest } = compile('src/components/FeedControls/feedApi.js', {
    sessionStorage: { getItem: () => token },
    fetch: (url, options) => { calls.push({ url, options }); return new Promise(done => { resolve = done; }); },
  });
  await assert.rejects(feedRequest('/preferences'), /Sign in/);
  assert.equal(calls.length, 0);
  token = 'account-one';
  const pending = feedRequest('/preferences', { method: 'PATCH', body: JSON.stringify({ followedTopics: ['space'] }) });
  assert.equal(calls[0].url, 'https://feed-controls.test/feed/preferences');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer account-one');
  resolve({ ok: true, json: async () => ({ preferences: { followedTopics: ['space'] }, interests: [{ topic: 'space', source: 'followed' }], signalsCount: 3 }) });
  const result = await pending;
  assert.equal(result.preferences.followedTopics[0], 'space');
  assert.equal(result.interests[0].source, 'followed');
  assert.equal(result.signalsCount, 3);
  const stale = feedRequest('/reset', { method: 'POST', body: '{}' });
  token = 'account-two';
  resolve({ ok: true, json: async () => ({ preferences: {}, interests: [], signalsCount: 0 }) });
  await assert.rejects(stale, /account changed/);
});

test('story explanations render actual supplied reasons without inventing fallback explanations', () => {
  const React = frontendRequire('react');
  const { renderToStaticMarkup } = frontendRequire('react-dom/server');
  const { WhyThisStory, default: FeedControls } = compile('src/components/FeedControls/FeedControls.jsx');
  assert.equal(renderToStaticMarkup(React.createElement(WhyThisStory, {})), '');
  const output = renderToStaticMarkup(React.createElement(WhyThisStory, { reasons: ['Because you follow space', 'Fresh from a different source', null] }));
  assert.ok(output.includes('Because you follow space'));
  assert.ok(output.includes('Fresh from a different source'));
  assert.equal((output.match(/<li /g) || []).length, 2);
  const trigger = renderToStaticMarkup(React.createElement(FeedControls));
  assert.ok(trigger.includes('Tune your feed'));
  assert.ok(trigger.includes('type="button"'));
});

test('deliberate search/open signals send only bounded metadata and honor server opt-out responses', async () => {
  const calls = [];
  const { sendFeedSignal, signalText } = compile('src/components/FeedControls/feedSignals.js', {
    sessionStorage: { getItem: () => 'current-user-token' },
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ recorded: false, message: 'Personalization is paused.' }) }; },
  });
  assert.equal(calls.length, 0, 'Importing signal helpers must never record an impression.');
  assert.equal(signalText('  חלל\u202e  telescope\n', 200), 'חלל telescope');
  const search = await sendFeedSignal('search', { query: '  חלל   telescope  ', topics: ['ignored'], title: 'Not a search field' });
  assert.equal(search.recorded, false);
  assert.deepEqual(JSON.parse(calls[0].options.body), { type: 'search', query: 'חלל telescope' });
  assert.equal(calls[0].options.headers.Authorization, 'Bearer current-user-token');
  await sendFeedSignal('open', { url: 'https://example.com/story', title: 'x'.repeat(500), privateField: 'ignored' });
  const open = JSON.parse(calls[1].options.body);
  assert.deepEqual(Object.keys(open), ['type','url','title']);
  assert.equal(open.title.length, 300);
  assert.equal(calls[1].options.keepalive, true);
});
