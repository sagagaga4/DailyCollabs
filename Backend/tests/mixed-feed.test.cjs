const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire, Module } = require('node:module');
const base = path.resolve(__dirname, '../../Frontend/client');
const helpers = () => import(pathToFileURL(path.join(base, 'src/components/Home/mixedFeed.js')).href);
const video = { kind: 'video', id: 'aqz-KE-bpKQ', title: 'A topic-specific video', videoUrl: 'https://youtu.be/aqz-KE-bpKQ?si=tracking', thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg', channel: 'An actual creator', topic: 'Skyrim', reasons: ['From a followed topic'] };

test('mixed normalization preserves server interleaving and ranking rather than regrouping news and videos', async () => {
  const { normalizeMixedItems } = await helpers();
  const article = Object.freeze({ kind: 'article', link: 'https://publisher.example/a', title: 'A ranked news story', image: 'https://publisher.example/a.jpg', isTopicImage: false, reasons: ['Fresh reporting'], language: 'he', dir: 'rtl' });
  const input = Object.freeze([article, video, { ...article, link: 'https://publisher.example/b' }, { ...video, videoUrl: 'https://www.youtube.com/watch?v=eRsGyueVLvQ' }]);
  const nodes = normalizeMixedItems(input);
  assert.deepEqual(nodes.map((node) => node.kind), ['article', 'video', 'article', 'video']);
  assert.equal(nodes[0].item.image, article.image); assert.equal(nodes[0].item.isTopicImage, false); assert.equal(nodes[0].item.language, 'he'); assert.equal(nodes[0].item.dir, 'rtl');
  assert.deepEqual(nodes[0].item.reasons, article.reasons); assert.equal(nodes[1].item.topic, 'Skyrim');
  assert.deepEqual(normalizeMixedItems(input), nodes, 'The same response must keep the same item identity and order.');
});

test('deduplication uses canonical sources, while stable keys retain content type and do not depend on provider IDs', async () => {
  const { normalizeMixedItems, mixedFeedIdentity } = await helpers();
  const input = [
    { kind: 'article', id: 'same-provider-id', link: 'https://publisher.example/a?utm_source=x#part', title: 'First ranked copy' },
    { kind: 'article', link: 'https://publisher.example/a', title: 'Duplicate copy' },
    video, { ...video, id: 'another-id', videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=12' },
    { kind: 'article', link: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', title: 'The same video marked as an article' },
    { kind: 'article', id: 'same-provider-id', link: 'https://publisher.example/b', title: 'A distinct source sharing an ID' },
  ];
  const nodes = normalizeMixedItems(input);
  assert.equal(nodes.length, 3); assert.equal(new Set(nodes.map((node) => node.key)).size, 3);
  assert.equal(nodes[0].item.title, 'First ranked copy'); assert.ok(nodes[0].key.startsWith('article:')); assert.ok(nodes[1].key.startsWith('video:'));
  assert.equal(mixedFeedIdentity(video), mixedFeedIdentity({ ...video, videoUrl: 'https://www.youtube.com/shorts/aqz-KE-bpKQ' }));
});

test('invalid media and unsafe sources are omitted without manufacturing replacement videos, while real author/transcript metadata survives', async () => {
  const { normalizeMixedItems, normalizeMixedVideo } = await helpers();
  for (const source of [null, {}, { kind: 'video', videoUrl: 'javascript:alert(1)' }, { kind: 'video', videoUrl: 'https://www.youtube.com/results?search_query=Skyrim' }, { kind: 'article', link: 'data:text/html,hi' }, { kind: 'advertisement', url: 'https://example.com' }]) assert.deepEqual(normalizeMixedItems([source]), []);
  assert.deepEqual(normalizeMixedItems([]), []);
  const shared = normalizeMixedVideo({ ...video, channel: '', author: { _id: 'author-id', username: 'a_real_member', avatar: '' }, transcript: 'תמליל אמיתי', createdAt: '2026-11-05T10:00:00Z', thumbnailUrl: 'javascript:alert(1)' });
  assert.equal(shared.author.username, 'a_real_member'); assert.equal(shared.channel, '@a_real_member'); assert.equal(shared.transcript, 'תמליל אמיתי'); assert.equal(shared.published, '2026-11-05T10:00:00Z'); assert.equal(shared.thumbnailUrl, '');
});

test('a rendered mixed video uses shared player/artwork and genuine card actions, with no separate discovery section or demo content', () => {
  const frontendRequire = createRequire(path.join(base, 'package.json'));
  const React = frontendRequire('react');
  const { renderToStaticMarkup } = frontendRequire('react-dom/server');
  const esbuild = frontendRequire('esbuild');
  const entry = `import React from 'react'; import {MemoryRouter} from 'react-router-dom'; import Card from './src/components/Home/MixedVideoCard.jsx'; import {CardActionsContext} from './src/components/CardActions/useCardActions.js'; const noop=()=>{}; export default function Test(props){return <MemoryRouter><CardActionsContext.Provider value={{beginDrag:noop,updateDrag:noop,finishDrag:noop,cancelDrag:noop,openActions:noop,communities:[],communitiesLoading:false,joinCommunity:noop,joining:''}}><Card {...props}/></CardActionsContext.Provider></MemoryRouter>}`;
  const code = esbuild.buildSync({ stdin: { contents: entry, resolveDir: base, loader: 'jsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', define: { 'import.meta.env': '{}' }, external: ['react', 'react/*', 'react-dom', 'react-dom/*', 'react-router-dom'], loader: { '.css': 'empty' } }).outputFiles[0].text;
  const filename = path.join(base, 'mixed-feed-test-compiled.cjs');
  const compiled = new Module(filename, module); compiled.paths = Module._nodeModulePaths(base); compiled._compile(code, filename);
  const html = renderToStaticMarkup(React.createElement(compiled.exports.default, { item: { ...video, thumbnailUrl: '', transcript: 'A real transcript', author: { _id: 'member-id', username: 'real_member' } }, autoplayMuted: true, onFeedback: () => {} }));
  assert.match(html, /Shared by @real_member/); assert.match(html, /Unmute/); assert.match(html, /Comments/); assert.match(html, /Repost/); assert.match(html, /More like this/); assert.match(html, /Save video/); assert.match(html, /Read transcript/); assert.match(html, /Open original/);
  assert.ok(!html.includes('WATCH &amp; LEARN')); assert.ok(!html.includes('STAY CURIOUS')); assert.ok(!html.includes('SAMPLE VIDEO')); assert.ok(!html.includes('<iframe'));
});
