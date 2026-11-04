const User = require('../model/User');

const DEFAULT_PREFERENCES = { theme: 'dark', textSize: 'default', reducedMotion: false };
const MAX_AVATAR_BYTES = 500 * 1024;
const USERNAME = /^[a-zA-Z0-9_]{3,30}$/;

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function safeProfile(user, own = true) {
  const data = typeof user.toObject === 'function' ? user.toObject() : user;
  const profile = {
    _id: String(data._id),
    fullname: data.fullname || '',
    username: data.username || '',
    bio: data.bio || '',
    avatar: data.avatar || '',
  };
  if (own) {
    profile.email = data.email || '';
    profile.preferences = { ...DEFAULT_PREFERENCES, ...(data.preferences || {}) };
  }
  return profile;
}

function validateAvatar(avatar) {
  if (typeof avatar !== 'string') badRequest('Choose a PNG, JPEG, or WebP image.');
  if (avatar === '') return '';
  const match = avatar.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) badRequest('Choose a PNG, JPEG, or WebP image.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) badRequest('Your avatar must be smaller than 500 KB.');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if ((match[1] === 'png' && !png) || (match[1] === 'jpeg' && !jpeg) || (match[1] === 'webp' && !webp)) {
    badRequest('The image file does not match its format.');
  }
  return avatar;
}

function validateProfilePatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) badRequest('Invalid profile update.');
  const allowed = new Set(['fullname', 'username', 'bio', 'avatar', 'preferences']);
  if (Object.keys(body).some(key => !allowed.has(key))) badRequest('This field cannot be changed in profile settings.');
  const patch = {};
  if ('fullname' in body) {
    if (typeof body.fullname !== 'string' || !body.fullname.trim() || body.fullname.trim().length > 60) badRequest('Display name must be between 1 and 60 characters.');
    patch.fullname = body.fullname.trim();
  }
  if ('username' in body) {
    if (typeof body.username !== 'string' || !USERNAME.test(body.username.trim())) badRequest('Username must be 3–30 letters, numbers, or underscores.');
    patch.username = body.username.trim();
  }
  if ('bio' in body) {
    if (typeof body.bio !== 'string' || body.bio.length > 240) badRequest('Bio must be 240 characters or fewer.');
    patch.bio = body.bio.trim();
  }
  if ('avatar' in body) patch.avatar = validateAvatar(body.avatar);
  if ('preferences' in body) {
    const prefs = body.preferences;
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) badRequest('Invalid appearance settings.');
    if (Object.keys(prefs).some(key => !Object.hasOwn(DEFAULT_PREFERENCES, key))) badRequest('Unknown appearance setting.');
    if ('theme' in prefs && !['dark', 'dim', 'light', 'system'].includes(prefs.theme)) badRequest('Choose a supported theme.');
    if ('textSize' in prefs && !['small', 'default', 'large'].includes(prefs.textSize)) badRequest('Choose a supported text size.');
    if ('reducedMotion' in prefs && typeof prefs.reducedMotion !== 'boolean') badRequest('Reduced motion must be on or off.');
    for (const [key, value] of Object.entries(prefs)) patch[`preferences.${key}`] = value;
  }
  if (!Object.keys(patch).length) badRequest('No profile changes to save.');
  return patch;
}

async function updateProfile(userId, body) {
  const patch = validateProfilePatch(body);
  if (patch.username) {
    const taken = await User.findOne({ username: new RegExp(`^${patch.username}$`, 'i'), _id: { $ne: userId } }).select('_id');
    if (taken) {
      const error = new Error('That username is already taken. Try another one.');
      error.status = 409;
      throw error;
    }
  }
  const user = await User.findByIdAndUpdate(userId, { $set: patch }, { new: true, runValidators: true }).select('-password');
  if (!user) {
    const error = new Error('Your account could not be found.');
    error.status = 404;
    throw error;
  }
  return safeProfile(user);
}

module.exports = { DEFAULT_PREFERENCES, MAX_AVATAR_BYTES, safeProfile, validateAvatar, validateProfilePatch, updateProfile };
