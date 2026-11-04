const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const frontendRoot = path.resolve(__dirname, '../../Frontend/client');
const frontendRequire = createRequire(path.join(frontendRoot, 'package.json'));
const esbuild = frontendRequire('esbuild');
function compile(filename, globals = {}) {
  const output = esbuild.buildSync({ entryPoints: [path.join(frontendRoot, filename)], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react'] });
  const module = { exports: {} };
  vm.runInNewContext(output.outputFiles[0].text, { module, exports: module.exports, require: frontendRequire, URL, ...globals });
  return module.exports;
}

test('viewport playback URLs preserve captions, controls, muted startup, origin and single-video loops', () => {
  const { parseVideoUrl } = compile('src/lib/media.js');
  const { playbackEmbedUrl } = compile('src/lib/videoPlayback.js');
  const youtube = parseVideoUrl('https://youtu.be/aqz-KE-bpKQ');
  const url = new URL(playbackEmbedUrl(youtube, { autoplayMuted: true, loop: true, origin: 'http://localhost:5173' }));
  assert.equal(url.hostname, 'www.youtube-nocookie.com');
  assert.equal(url.searchParams.get('mute'), '1');
  assert.equal(url.searchParams.get('autoplay'), '0', 'Only the in-view ready callback may start playback.');
  assert.equal(url.searchParams.get('enablejsapi'), '1');
  assert.equal(url.searchParams.get('controls'), '1');
  assert.equal(url.searchParams.get('cc_load_policy'), '1');
  assert.equal(url.searchParams.get('origin'), 'http://localhost:5173');
  assert.equal(url.searchParams.get('playlist'), youtube.id);
  const vimeo = new URL(playbackEmbedUrl(parseVideoUrl('https://vimeo.com/12345678'), { autoplayMuted: true }));
  assert.equal(vimeo.searchParams.get('muted'), '1');
  assert.equal(vimeo.searchParams.get('controls'), '1');
  const explicit = new URL(playbackEmbedUrl(youtube));
  assert.equal(explicit.searchParams.get('mute'), '0');
  assert.equal(explicit.searchParams.has('loop'), false);
  assert.equal(playbackEmbedUrl(parseVideoUrl('https://example.com/video.mp4')), null);
});

test('each provider SDK loads once and shares readiness across simultaneous visible players', async () => {
  const scripts = [];
  const window = {};
  const { loadVideoApi } = compile('src/lib/videoPlayback.js', {
    window, document: { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } },
    setTimeout: () => 1, clearTimeout: () => {},
  });
  const first = loadVideoApi('youtube'); const second = loadVideoApi('youtube');
  assert.equal(first, second); assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://www.youtube.com/iframe_api');
  window.YT = { Player: function Player() {} }; window.onYouTubeIframeAPIReady();
  assert.equal(await first, window.YT);
  assert.equal(await loadVideoApi('youtube'), window.YT); assert.equal(scripts.length, 1);
});

test('delayed automatic pause acknowledgements resume in-view playback without overriding a deliberate pause', () => {
  let time = 1000;
  const { createPlaybackIntent } = compile('src/lib/videoPlayback.js');
  const intent = createPlaybackIntent(() => time);
  intent.playAutomatically(); intent.playing();
  intent.pauseAutomatically();
  time += 100;
  intent.playAutomatically(); intent.playing();
  assert.equal(intent.paused(true), 'resume', 'A late visibility-pause acknowledgement must restart the now-visible player.');
  assert.equal(intent.canResume(), true);
  intent.playing();
  time += 3000;
  assert.equal(intent.paused(true), 'user');
  assert.equal(intent.canResume(), false);
  intent.pauseAutomatically(); intent.playAutomatically();
  assert.equal(intent.paused(true), 'automatic');
  assert.equal(intent.canResume(), false, 'Scrolling away and back must respect a deliberate player pause.');
  intent.playExplicitly();
  assert.equal(intent.canResume(), true, 'An explicit Play action may resume after a user pause.');
  intent.pauseAutomatically();
  assert.equal(intent.paused(false), 'automatic');
  assert.equal(intent.playing(false), 'pause', 'A late Play acknowledgement after tab hide must pause immediately.');
  assert.equal(intent.paused(false), 'automatic');
  assert.equal(intent.canResume(), true);
  time += 3000;
  intent.playAutomatically();
  assert.equal(intent.paused(true), 'user', 'Expired pause guards must not swallow later user pauses.');
});

test('For you has no click-to-load facade while explicit playback stays deliberate and unsafe media is excluded', () => {
  const React = frontendRequire('react');
  const { renderToStaticMarkup } = frontendRequire('react-dom/server');
  const { default: VideoPlayer } = compile('src/components/Home/VideoPlayer.jsx');
  const url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const forYou = renderToStaticMarkup(React.createElement(VideoPlayer, { url, title: 'A real video', autoplayMuted: true }));
  assert.ok(forYou.includes('Autoplays muted'));
  assert.ok(forYou.includes('Unmute A real video'));
  assert.equal(forYou.includes('home-video-poster '), false);
  assert.equal(forYou.includes('<iframe'), false, 'Offscreen players wait for IntersectionObserver, without a click facade.');
  const explicit = renderToStaticMarkup(React.createElement(VideoPlayer, { url, title: 'A real video' }));
  assert.ok(explicit.includes('Watch video'));
  assert.equal(explicit.includes('Autoplays muted'), false);
  assert.equal(renderToStaticMarkup(React.createElement(VideoPlayer, { url: 'javascript:alert(1)', autoplayMuted: true })), '');
});
