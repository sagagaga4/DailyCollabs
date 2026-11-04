const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function storage() { const items = new Map(); return { getItem: key => items.has(key) ? items.get(key) : null, setItem: (key,value) => items.set(key,String(value)), removeItem: key => items.delete(key) }; }
function token(id) { return `fixture.${Buffer.from(JSON.stringify({id})).toString('base64url')}.fixture`; }
async function moduleFor(fetchImpl) {
  global.sessionStorage = storage(); global.localStorage = storage(); global.window = new EventTarget(); global.fetch = fetchImpl;
  const source = fs.readFileSync(path.resolve(__dirname,'../../Frontend/client/src/lib/bookmarks.js'),'utf8').replace("import { API_URL } from '../config';", "const API_URL = 'http://localhost:4000';");
  return import(`data:text/javascript;base64,${Buffer.from(source + `\n//${Math.random()}`).toString('base64')}`);
}
function json(value) { return new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}); }
const story = {link:'https://example.com/story',title:'A story'};

test('unowned legacy bookmarks stay untouched and cannot be claimed by a new account', async () => {
  const lib = await moduleFor(async()=>json([])); sessionStorage.setItem('token',token('a')); localStorage.setItem('bookmarkedArticles',JSON.stringify([story.link]));
  assert.deepEqual(lib.readBookmarks(),[]); assert.equal(localStorage.getItem('dailycollabs:legacy-bookmark-owner'),null);
  await lib.loadBookmarks(); assert.equal(localStorage.getItem('bookmarkedArticles'),JSON.stringify([story.link]));
});
test('owned local collection migrates once, then remote deletions remain authoritative', async () => {
  let remote = []; let posts = 0;
  const lib = await moduleFor(async(url,options)=>{if(options.method==='POST'){posts++;const item=JSON.parse(options.body);remote.push(item);return json(item);}return json(remote);});
  sessionStorage.setItem('token',token('a')); localStorage.setItem('dailycollabs:legacy-bookmark-owner','a');localStorage.setItem('bookmarkedArticles',JSON.stringify([story.link]));
  assert.equal((await lib.loadBookmarks()).length,1);assert.equal(posts,1);remote=[];
  assert.deepEqual(await lib.loadBookmarks(),[]);assert.equal(posts,1);assert.deepEqual(lib.readBookmarks(),[]);
});
test('concurrent different-link saves keep both results instead of overwriting cache snapshots', async () => {
  const lib = await moduleFor(async(url,options)=>json(JSON.parse(options.body)));sessionStorage.setItem('token',token('a'));
  await Promise.all([lib.toggleBookmark(story,true),lib.toggleBookmark({link:'https://example.com/two',title:'Two'},true)]);
  assert.equal(lib.readBookmarks().length,2);
});
test('account switch during collection load never uploads old bookmarks with a new token', async () => {
  let complete;const calls=[];
  const lib=await moduleFor(async(url,options)=>{calls.push(options);if(options.method==='GET')return new Promise(resolve=>{complete=resolve;});return json({});});
  sessionStorage.setItem('token',token('a'));localStorage.setItem('dailycollabs:bookmarks:a',JSON.stringify([story]));
  const load=lib.loadBookmarks();await new Promise(resolve=>setImmediate(resolve));sessionStorage.setItem('token',token('b'));complete(json([]));
  await assert.rejects(load,/session changed/);assert.equal(calls.length,1);assert.equal(calls[0].headers.Authorization,`Bearer ${token('a')}`);assert.deepEqual(lib.readBookmarks(),[]);
});
test('inflight saves are scoped to account and do not suppress a different account saving the same story', async () => {
  let complete;const calls=[];
  const lib=await moduleFor(async(url,options)=>{calls.push(options.headers.Authorization);if(calls.length===1)return new Promise(resolve=>{complete=resolve;});return json(JSON.parse(options.body));});
  sessionStorage.setItem('token',token('a'));const first=lib.toggleBookmark(story,true);const firstSettled=first.catch(error=>error);await new Promise(resolve=>setImmediate(resolve));
  sessionStorage.setItem('token',token('b'));await lib.toggleBookmark(story,true);complete(json(story));assert.match((await firstSettled).message,/session changed/);
  assert.deepEqual(calls,[`Bearer ${token('a')}`,`Bearer ${token('b')}`]);assert.equal(lib.readBookmarks().length,1);assert.equal(localStorage.getItem('dailycollabs:bookmarks:a'),null);
});
test('malformed cached metadata cannot discard valid entries or create unsafe navigation', async () => {
  const lib=await moduleFor(async()=>json([]));sessionStorage.setItem('token',token('a'));localStorage.setItem('dailycollabs:bookmarks:a',JSON.stringify([{...story,title:42,description:{}},{link:'javascript:alert(1)'},{...story,link:'https://example.com/two',title:'Two',image:'https://name:secret@example.com/a.png'}]));
  const entries=lib.readBookmarks();assert.equal(entries.length,2);assert.equal(entries[0].title,'example.com');assert.equal(entries[1].image,'');assert.equal(lib.safeLink('https://name:secret@example.com'), '');
});
