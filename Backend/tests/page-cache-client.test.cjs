const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const frontend = path.resolve(__dirname, '../../Frontend/client');
const frontendRequire = createRequire(path.join(frontend, 'package.json'));
function compile(file, globals = {}) {
  const output = frontendRequire('esbuild').buildSync({ entryPoints: [path.join(frontend, 'src/components/Navigation', file)], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/*'], loader: { '.css': 'empty' } });
  const module = { exports: {} };
  vm.runInNewContext(output.outputFiles[0].text, { module, exports: module.exports, require: frontendRequire, ...globals });
  return module.exports;
}
const location = (pathname, key = pathname, search = '') => ({ pathname, key, search, hash: '', state: null });

test('visited route cache reuses pathname/search, bounds least-used entries, and resets every account token', () => {
  const { createPageCache, visitPage, pageCacheKey } = compile('pageCache.js');
  let cache = createPageCache('first-token');
  cache = visitPage(cache, 'first-token', location('/', 'initial'));
  const home = cache.entries[0];
  cache = visitPage(cache, 'first-token', location('/Communities/a', 'a1', '?channel=general'));
  cache = visitPage(cache, 'first-token', location('/Communities/a', 'a2', '?channel=music'));
  assert.equal(cache.entries.length, 3);
  cache = visitPage(cache, 'first-token', location('/', 'back-home'));
  assert.equal(cache.entries.length, 3); assert.equal(cache.entries[0].key, home.key);
  for (let index = 0; index < 11; index++) cache = visitPage(cache, 'first-token', location(`/page/${index}`));
  assert.equal(cache.entries.length, 12); assert.ok(cache.entries.some(entry => entry.key === '/'));
  assert.ok(!cache.entries.some(entry => entry.key === '/Communities/a?channel=general'));
  assert.equal(pageCacheKey(location('/Communities/a', 'different-history', '?channel=music')), '/Communities/a?channel=music');
  const reset = visitPage(cache, 'second-token', location('/', 'new-account'));
  assert.equal(reset.entries.length, 1); assert.equal(reset.owner, 'second-token');
  assert.notEqual(reset.entries[0], home);
});

test('each mounted cached route keeps its own router params/location and inactive activity context', () => {
  const React = frontendRequire('react'); const { renderToStaticMarkup } = frontendRequire('react-dom/server');
  const { MemoryRouter, Routes, Route, useLocation, useParams } = frontendRequire('react-router-dom');
  const { default: Cache } = compile('RouteCache.jsx');
  const a = location('/Communities/alpha', 'a'); const b = location('/Communities/beta', 'b');
  function Probe() { return React.createElement('span', { 'data-community': useParams().id, 'data-location': useLocation().pathname }); }
  const props = { owner: 'token', location: b, validLocation: true, renderPage: cached => React.createElement(Routes, { location: cached }, React.createElement(Route, { path: '/Communities/:id', element: React.createElement(Probe) })) };
  const cache = new Cache(props); const { createPageCache, visitPage } = compile('pageCache.js');
  cache.state = visitPage(visitPage(createPageCache('token'), 'token', a), 'token', b);
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [b.pathname] }, cache.render()));
  assert.equal(cache.render()[0].props.children.props.active, false); assert.equal(cache.render()[1].props.children.props.active, true);
  assert.match(html, /data-community="alpha" data-location="\/Communities\/alpha"/);
  assert.match(html, /data-community="beta" data-location="\/Communities\/beta"/);
  assert.match(html, /data-page-active="false" hidden="" inert="" aria-hidden="true"/);
  assert.match(html, /data-page-active="true" aria-hidden="false"/);
});

test('Settings URL variants reconcile to one mounted draft while semantic community queries keep separate entries', () => {
  const React = frontendRequire('react'); const { default: Cache } = compile('RouteCache.jsx');
  const { visitPage } = compile('pageCache.js');
  function SettingsDraft() { return React.createElement('textarea', { defaultValue: 'An unfinished profile draft' }); }
  const initial = { owner: 'token', location: location('/Settings', 'settings-a'), validLocation: true, renderPage: () => React.createElement(SettingsDraft) };
  const cache = new Cache(initial); const first = cache.render()[0];
  for (const [index, pathname] of ['/settings/', '/SETTINGS', '/Settings///'].entries()) {
    const next = location(pathname, `settings-${index}`, `?preview=${index}`);
    cache.props = { ...initial, location: next }; cache.state = visitPage(cache.state, 'token', next);
    const current = cache.render();
    assert.equal(current.length, 1);
    assert.equal(current[0].key, first.key, 'A stable page key retains React state and the unfinished draft.');
    assert.equal(current[0].props.children.props.children.type, first.props.children.props.children.type);
    assert.equal(cache.state.entries[0].location, next, 'Router context still receives the current URL.');
  }
  cache.state = visitPage(cache.state, 'token', location('/Communities/a', 'general', '?channel=general'));
  cache.state = visitPage(cache.state, 'token', location('/Communities/a', 'music', '?channel=music'));
  assert.equal(cache.state.entries.length, 3);
});

function environment() {
  const frames = new Map(); let nextFrame = 0; const listeners = new Map(); const observers = [];
  const window = { scrollX: 0, scrollY: 0, innerHeight: 900, history: { scrollRestoration: 'auto' }, maxScroll: Infinity,
    scrollTo({ left, top }) { this.scrollX = left; this.scrollY = Math.min(top, this.maxScroll); },
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); } };
  const document = { activeElement: null, body: {}, querySelector: () => null, addEventListener() {}, removeEventListener() {}, getElementById: () => null };
  const globals = { window, document, requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame: id => frames.delete(id), setTimeout: () => 1, clearTimeout() {}, ResizeObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() {} } };
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  return { window, document, globals, flush, observers, listeners };
}

test('pre-hide lifecycle captures a deep document before layout clamp and browser Back restores exact history/focus', () => {
  const env = environment(); const { default: Cache } = compile('RouteCache.jsx', env.globals); const { visitPage } = compile('pageCache.js');
  const home = location('/', 'home-history'); const settings = location('/Settings', 'settings-history'); let pauses = 0; let focused = false;
  const input = { isConnected: true, getClientRects: () => [{}], focus: () => { focused = true; } };
  const node = { isConnected: true, hidden: false, querySelectorAll: selector => selector === 'video,audio' ? [{ pause: () => pauses++ }] : [], contains: value => value === input, focus() {} };
  const shortNode = { ...node, contains: () => false };
  const initial = { owner: 'token', location: home, validLocation: true, navigationType: 'POP', renderPage: () => null };
  const cache = new Cache(initial); cache.nodes.set('/', node); cache.nodes.set('/Settings', shortNode); env.document.activeElement = input;
  env.window.scrollY = 2464;
  cache.props = { ...initial, location: settings, navigationType: 'PUSH' }; cache.state = visitPage(cache.state, 'token', settings);
  const snapshot = cache.getSnapshotBeforeUpdate(initial);
  assert.equal(cache.positions.get('/').y, 2464); assert.equal(pauses, 1);
  node.hidden = true; env.window.scrollY = 0; cache.componentDidUpdate(initial, null, snapshot);
  assert.equal(env.window.scrollY, 0);
  const previous = cache.props; env.window.scrollY = 80;
  cache.props = initial; cache.state = visitPage(cache.state, 'token', home);
  const returning = cache.getSnapshotBeforeUpdate(previous);
  node.hidden = false; shortNode.hidden = true; env.window.scrollY = 0; cache.componentDidUpdate(previous, null, returning);
  assert.equal(env.window.scrollY, 2464); assert.equal(focused, true);
  const samePage = { ...initial, location: { ...home, key: 'new-home-history', hash: '#story' }, navigationType: 'PUSH' };
  const pausesBefore = pauses; cache.props = samePage; cache.getSnapshotBeforeUpdate(initial);
  assert.equal(pauses, pausesBefore, 'Clicking the same page or changing only its hash must not pause a still-active player.');
  cache.cancelRestore();
});

test('anchor restoration handles late height changes and immediately yields to user scrolling', () => {
  const env = environment(); let documentTop = 1050;
  const anchor = { getAttribute: () => 'story/one', getBoundingClientRect: () => ({ width: 300, top: documentTop - env.window.scrollY, bottom: documentTop + 300 - env.window.scrollY }) };
  const scope = { isConnected: true, hidden: false, querySelectorAll: () => [anchor] };
  env.document.querySelector = () => scope;
  const { captureScrollPosition, restoreScrollPosition } = compile('scrollPosition.js', env.globals);
  env.window.scrollY = 1000; const position = captureScrollPosition(); assert.equal(position.anchor.top, 50);
  env.window.scrollY = 0; env.window.maxScroll = 500;
  const cancel = restoreScrollPosition(position); assert.equal(env.window.scrollY, 500);
  env.window.maxScroll = 3000; documentTop = 1500; env.observers[0].callback(); env.flush();
  assert.equal(env.window.scrollY, 1450);
  env.listeners.get('wheel')(); env.window.scrollY = 600; documentTop = 1700; env.observers[0].callback(); env.flush();
  assert.equal(env.window.scrollY, 600, 'A late resize must not pull the reader back after wheel/touch/key input.'); cancel();
});
