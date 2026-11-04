const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../model/User');
const { validateProfilePatch, safeProfile, MAX_AVATAR_BYTES } = require('../services/profileService');

const userId = '507f1f77bcf86cd799439011';
const otherId = '507f1f77bcf86cd799439012';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0pEAAAAASUVORK5CYII=';

test('profile validator whitelists fields and validates appearance without accepting arbitrary writes', () => {
  assert.deepEqual(validateProfilePatch({ fullname: ' New Name ', username: 'new_name', bio: ' Hello ', preferences: { theme: 'dim', textSize: 'large', reducedMotion: true } }), {
    fullname: 'New Name', username: 'new_name', bio: 'Hello', 'preferences.theme': 'dim', 'preferences.textSize': 'large', 'preferences.reducedMotion': true,
  });
  for (const body of [{}, { password: 'secret' }, { email: 'changed@example.com' }, { _id: otherId }, { username: { $ne: '' } }, { username: 'a.*' }, { bio: 'x'.repeat(241) }, { preferences: { theme: 'unsupported' } }, { preferences: { reducedMotion: 'true' } }, { preferences: { role: 'admin' } }, { preferences: null }]) {
    assert.throws(() => validateProfilePatch(body), error => error.status === 400);
  }
});

test('profile avatar accepts real raster headers and rejects SVG, spoofed formats, and oversized images', () => {
  assert.equal(validateProfilePatch({ avatar: png }).avatar, png);
  assert.equal(validateProfilePatch({ avatar: '' }).avatar, '');
  const tooBig = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(MAX_AVATAR_BYTES)]).toString('base64');
  for (const avatar of ['data:image/svg+xml;base64,PHN2Zz4=', 'https://example.com/avatar.png', 'data:image/png;base64,PHNjcmlwdD4=', `data:image/png;base64,${tooBig}`]) {
    assert.throws(() => validateProfilePatch({ avatar }), error => error.status === 400);
  }
});

test('profile serialization removes private credentials and public directory hides email/preferences', () => {
  const record = { _id: userId, fullname: 'Member', username: 'member', email: 'private@example.com', password: 'hash', __v: 1 };
  assert.equal(safeProfile(record).password, undefined);
  assert.equal(safeProfile(record).email, record.email);
  assert.equal(safeProfile(record, false).email, undefined);
  assert.equal(safeProfile(record, false).preferences, undefined);
  const document = new User(record);
  assert.equal(document.toJSON().password, undefined);
});

test('authenticated profile API persists whitelisted changes and prevents cross-account access', async t => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'profile-test-only-secret';
  let profile = { _id: userId, fullname: 'Member', username: 'member', email: 'private@example.com', password: 'hash', preferences: { theme: 'dark', textSize: 'default', reducedMotion: false } };
  let taken = false;
  let lastTarget;
  const originals = Object.fromEntries(['findById', 'findByIdAndUpdate', 'findOne', 'find'].map(key => [key, User[key]]));
  User.findById = id => ({ select: async () => id === userId ? { ...profile } : { ...profile, _id: otherId, email: 'another@example.com' } });
  User.findOne = () => ({ select: async () => taken ? { _id: otherId } : null });
  User.find = () => ({ select: () => ({ limit: async () => [{ ...profile }] }) });
  User.findByIdAndUpdate = (id, update) => ({ select: async () => {
    lastTarget = id;
    for (const [key, value] of Object.entries(update.$set)) {
      if (key.startsWith('preferences.')) profile.preferences[key.split('.')[1]] = value;
      else profile[key] = value;
    }
    return { ...profile };
  } });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/users', require('../routers/userRouter'));
  const server = await new Promise(resolve => { const current = app.listen(0, '127.0.0.1', () => resolve(current)); });
  t.after(async () => {
    Object.assign(User, originals);
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    await new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}/users`;
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
  const request = (path, method = 'GET', body, authenticated = true) => fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal((await request('/me', 'GET', undefined, false)).status, 401);
  assert.equal((await request('/me', 'PATCH', { fullname: 'Intruder' }, false)).status, 401);
  const own = await (await request('/me')).json();
  assert.equal(own._id, userId);
  assert.equal(own.password, undefined);
  assert.equal(own.email, 'private@example.com');
  const changed = await request('/me', 'PATCH', { fullname: 'Updated Member', username: 'updated_member', avatar: png, preferences: { theme: 'light' } });
  assert.equal(changed.status, 200);
  const saved = await changed.json();
  assert.equal(lastTarget, userId);
  assert.equal(saved.fullname, 'Updated Member');
  assert.equal(saved.avatar, png);
  assert.deepEqual(saved.preferences, { theme: 'light', textSize: 'default', reducedMotion: false });
  assert.equal((await (await request('/me')).json()).username, 'updated_member');
  taken = true;
  assert.equal((await request('/me', 'PATCH', { username: 'taken_name' })).status, 409);
  assert.equal(profile.username, 'updated_member');
  assert.equal((await request('/me', 'PATCH', { password: 'bad-write' })).status, 400);
  assert.equal((await request('/me', 'PATCH', { _id: otherId, fullname: 'Bad' })).status, 400);
  assert.equal((await request(`/${otherId}`, 'DELETE')).status, 403);
  assert.equal((await request(`/${otherId}/join/507f1f77bcf86cd799439099`, 'POST', {})).status, 403);
  const other = await (await request(`/${otherId}`)).json();
  assert.equal(other.email, undefined);
  assert.equal(other.password, undefined);
  const directory = await (await request('')).json();
  assert.equal(directory[0].email, undefined);
  assert.equal(directory[0].password, undefined);
});
