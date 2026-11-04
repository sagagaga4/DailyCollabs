const mongoose = require('mongoose');
const SharedContent = require('../model/SharedContent');
const UserChannelPost = require('../model/UserChannelPost');
const Community = require('../model/Community');
const User = require('../model/User');
const communities = require('./communityService');

class ContentError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function safeContentUrl(value, required = true) {
  if (!required && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) throw new ContentError('Use a valid http or https link.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new ContentError('Use a valid http or https link.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname || url.href.length > 2048) throw new ContentError('Use a valid http or https link.');
  return url.href;
}

function text(value, max, label, required = false) {
  if (value !== undefined && value !== null && typeof value !== 'string') throw new ContentError(`${label} must be text.`);
  const result = typeof value === 'string' ? value.trim() : '';
  if ((required && !result) || result.length > max) throw new ContentError(required ? `${label} must contain 1–${max} characters.` : `${label} must be ${max} characters or fewer.`);
  return result;
}

function normalizeContent(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ContentError('Choose an article or video to share.');
  if (!['article', 'video'].includes(input.type)) throw new ContentError('Choose an article or video to share.');
  return { type: input.type, url: safeContentUrl(input.url), title: text(input.title, 200, 'Title', true), image: safeContentUrl(input.image, false), description: text(input.description, 500, 'Description') };
}

function channelId(value = 'general') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new ContentError('Choose a valid channel.');
  return value;
}

async function requireActor(userId) {
  if (!mongoose.isObjectIdOrHexString(userId) || !await User.exists({ _id: userId })) throw new ContentError('Please sign in again.', 401);
}

async function requireMembership(id, userId) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new ContentError('Community not found.', 404);
  const community = await Community.findById(id).select('_id name members');
  if (!community) throw new ContentError('Community not found.', 404);
  if (!(community.members || []).map(String).includes(String(userId))) throw new ContentError('Join this community before sharing with it.', 403);
  return community;
}

async function repost(userId, body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ContentError('Choose an article or video to share.');
  const content = normalizeContent(body.content);
  const note = text(body.note, 1200, 'Your note');
  await requireActor(userId);
  const existing = await UserChannelPost.findOne({ ownerId: userId, 'content.url': content.url });
  if (existing) return { post: existing, created: false };
  try { return { post: await UserChannelPost.create({ ownerId: userId, content, note }), created: true }; }
  catch (error) {
    if (error.code !== 11000) throw error;
    return { post: await UserChannelPost.findOne({ ownerId: userId, 'content.url': content.url }), created: false };
  }
}

async function shareToCommunity(userId, body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ContentError('Choose an article or video to share.');
  const content = normalizeContent(body.content);
  const note = text(body.note, 1200, 'Your note');
  const targetChannel = channelId(body.channelId);
  await requireActor(userId);
  await requireMembership(body.communityId, userId);
  if (typeof communities.createChannelMessage !== 'function') throw new ContentError('Community channels are starting up. Please try again shortly.', 503);
  let record;
  try { record = await SharedContent.create({ actorId: userId, communityId: body.communityId, channelId: targetChannel, content, note }); }
  catch (error) {
    if (error.code === 11000) throw new ContentError('You already shared this in that channel.', 409);
    throw error;
  }
  try {
    const message = await communities.createChannelMessage(body.communityId, userId, targetChannel, { content: note, attachment: { ...content, contentId: String(record._id) } });
    return { shared: record, message };
  } catch (error) {
    await SharedContent.deleteOne({ _id: record._id, actorId: userId });
    throw error;
  }
}

async function listChannel(userId, page = 1) {
  await requireActor(userId);
  const safePage = Math.max(1, Math.min(1000, parseInt(page, 10) || 1));
  const rows = await UserChannelPost.find({ ownerId: userId }).sort({ createdAt: -1 }).skip((safePage - 1) * 20).limit(21).lean();
  return { posts: rows.slice(0, 20), page: safePage, hasMore: rows.length > 20 };
}

async function listCommunityContent(userId, id, selectedChannel) {
  await requireActor(userId);
  await requireMembership(id, userId);
  const rows = await SharedContent.find({ communityId: id, channelId: channelId(selectedChannel) }).sort({ createdAt: -1 }).limit(50).populate('actorId', 'username avatar').lean();
  return { posts: rows };
}

async function removeRepost(userId, id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new ContentError('Saved post not found.', 404);
  await requireActor(userId);
  const deleted = await UserChannelPost.findOneAndDelete({ _id: id, ownerId: userId });
  if (!deleted) throw new ContentError('Saved post not found.', 404);
  return { message: 'Removed from your channel.' };
}

module.exports = { ContentError, safeContentUrl, normalizeContent, channelId, repost, shareToCommunity, listChannel, listCommunityContent, removeRepost };
