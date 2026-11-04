const mongoose = require('mongoose');
const Community = require('../model/Community');
const Message = require('../model/CommunityMessage');
const Reaction = require('../model/CommunityReaction');
const User = require('../model/User');
const { EMOJIS, normalizeEmoji } = require('../utils/communityEmojis');
const DEFAULT_CHANNELS = [
  { id: 'welcome', name: 'welcome-and-rules', topic: 'Start here. Get to know the community.', type: 'welcome', readOnly: true },
  { id: 'general', name: 'general', topic: 'Good conversations start here.', type: 'text', readOnly: false },
];
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function channelDefinitions(community) {
  const stored = community.channels || [];
  const defaults = DEFAULT_CHANNELS.map(channel => stored.find(item => item.id === channel.id) || channel);
  return [...defaults, ...stored.filter(channel => !DEFAULT_CHANNELS.some(item => item.id === channel.id))].map(channel => ({
    id: channel.id, name: channel.name, topic: channel.topic || '', type: channel.type || 'text', readOnly: channel.id === 'welcome' || Boolean(channel.readOnly),
  }));
}
async function getBoard(id) {
  if (!mongoose.isObjectIdOrHexString(id)) fail('Community not found.', 404);
  const board = await Community.findById(id).select('+rulesAcknowledgements');
  if (!board) fail('Community not found.', 404);
  return board;
}
function mustOwn(board, userId) {
  if (!board.ownerId || String(board.ownerId) !== String(userId)) fail('Only the community owner can manage this space.', 403);
}
function mustBelong(board, userId) {
  if (!(board.members || []).includes(String(userId))) fail('Join this community to take part.', 403);
}
function assertRulesAcknowledged(board, userId) {
  if (!board.requireRulesAcceptance || String(board.ownerId) === String(userId)) return;
  const acknowledgements = board.rulesAcknowledgements;
  const acknowledgement = typeof acknowledgements?.get === 'function' ? acknowledgements.get(String(userId)) : acknowledgements?.[String(userId)];
  if (!acknowledgement || acknowledgement.version !== (board.rulesVersion || 1)) fail('Read and accept the current community rules before posting or reacting.', 409);
}
async function assertPostingRules(communityId, userId, channelId = 'general') {
  const board = await getBoard(communityId);
  mustBelong(board, userId);
  assertRulesAcknowledged(board, userId);
  const channel = getChannel(board, channelId);
  if (channel.type === 'welcome' || (channel.readOnly && String(board.ownerId) !== String(userId))) fail('This channel is read-only.', 403);
  return board;
}
function getChannel(board, channelId) {
  const channel = channelDefinitions(board).find(item => item.id === channelId);
  if (!channel) fail('Channel not found.', 404);
  return channel;
}
function bounded(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(`${label} must be ${min}–${max} characters.`);
  return value.trim();
}
function safeLink(value, optional = false) {
  if (optional && !value) return '';
  if (typeof value !== 'string' || value.length > 2048) fail('Use a valid HTTP or HTTPS link.');
  let url;
  try { url = new URL(value); } catch { fail('Use a valid HTTP or HTTPS link.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('Use a valid HTTP or HTTPS link.');
  return url.href;
}
function validateMessage(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Write a message or share a link.');
  if (Object.keys(data).some(key => !['content', 'attachment'].includes(key))) fail('Unsupported message field.');
  const content = bounded(data.content || '', 'Message', data.attachment ? 0 : 1, 3000);
  let attachment = null;
  if (data.attachment) {
    const input = data.attachment;
    if (typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['type', 'url', 'title', 'image', 'description', 'contentId'].includes(key))) fail('Invalid shared content.');
    if (!['article', 'video'].includes(input.type)) fail('Choose an article or video to share.');
    if (input.contentId && !mongoose.isObjectIdOrHexString(input.contentId)) fail('Invalid shared content id.');
    attachment = { type: input.type, url: safeLink(input.url), title: bounded(input.title, 'Shared title', 1, 200), image: safeLink(input.image, true), description: bounded(input.description || '', 'Shared description', 0, 500), ...(input.contentId ? { contentId: input.contentId } : {}) };
  }
  return { content, attachment };
}
function publicMessage(message, userId, reactions = []) {
  const author = message.authorId;
  return { _id: String(message._id), communityId: String(message.communityId), channelId: message.channelId, content: message.content, attachment: message.attachment || null,
    createdAt: message.createdAt, author: author && typeof author === 'object' && author.username ? { _id: String(author._id), username: author.username, fullname: author.fullname || author.username, avatar: author.avatar || '' } : { username: 'former-member', fullname: 'Former member', avatar: '' },
    reactions: EMOJIS.map(emoji => { const group = reactions.filter(item => String(item.messageId) === String(message._id) && item.emoji === emoji); return { emoji, count: group.length, reacted: group.some(item => String(item.userId) === String(userId)) }; }).filter(item => item.count > 0),
  };
}
async function createChannelMessage(communityId, userId, channelId = 'general', data = {}) {
  await assertPostingRules(communityId, userId, channelId);
  if (!await User.exists({ _id: userId })) fail('Please sign in again.', 401);
  const checked = validateMessage(data);
  const record = await Message.create({ communityId, channelId, authorId: userId, ...checked });
  await record.populate('authorId', 'username fullname avatar');
  return publicMessage(record, userId);
}
async function getChannelMessages(communityId, channelId, userId, before) {
  const board = await getBoard(communityId);
  getChannel(board, channelId);
  if (before && !mongoose.isObjectIdOrHexString(before)) fail('Invalid message cursor.');
  const posts = await Message.find({ communityId, channelId, ...(before ? { _id: { $lt: before } } : {}) }).sort({ _id: -1 }).limit(51).populate('authorId', 'username fullname avatar').lean();
  const legacy = channelId === 'general' ? (board.discussions || []).filter(item => !before || String(item._id) < before).map(item => ({ _id: String(item._id), legacy: true, content: `${item.title}\n${item.content}`, createdAt: item.createdAt, author: { username: item.authorName, fullname: item.authorName, avatar: '' }, isDemo: item.isDemo, channelId: 'general', attachment: null, reactions: [] })) : [];
  const ids = posts.map(post => post._id);
  const reactions = ids.length ? await Reaction.find({ messageId: { $in: ids } }).lean() : [];
  const all = [...posts.map(post => publicMessage(post, userId, reactions)), ...legacy].sort((a, b) => String(b._id).localeCompare(String(a._id)));
  const messages = all.slice(0, 50).reverse();
  return { messages, hasMore: all.length > 50, nextCursor: messages[0]?._id || null };
}
async function toggleMessageReaction(communityId, messageId, userId, emoji) {
  const board = await getBoard(communityId); mustBelong(board, userId);
  assertRulesAcknowledged(board, userId);
  emoji = normalizeEmoji(emoji);
  if (!emoji) fail('Choose a DailyCollabs emoji.');
  if (!mongoose.isObjectIdOrHexString(messageId)) fail('Message not found.', 404);
  const message = await Message.findOne({ _id: messageId, communityId });
  if (!message) fail('Message not found.', 404);
  const query = { messageId, userId, emoji };
  const removed = await Reaction.findOneAndDelete(query);
  if (!removed) { try { await Reaction.create(query); } catch (error) { if (error.code !== 11000) throw error; } }
  await message.populate('authorId', 'username fullname avatar');
  return publicMessage(message, userId, await Reaction.find({ messageId }).lean());
}
async function createChannel(id, userId, data = {}) {
  const board = await getBoard(id); mustOwn(board, userId);
  const name = bounded(data.name, 'Channel name', 2, 32).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) fail('Use lowercase letters, numbers, and hyphens for channel names.');
  if (channelDefinitions(board).length >= 20) fail('A community can have up to 20 channels.');
  if (channelDefinitions(board).some(item => item.id === name || item.name === name)) fail('That channel already exists.', 409);
  const channel = { id: name, name, topic: bounded(data.topic || '', 'Channel topic', 0, 160), type: 'text', readOnly: data.readOnly === true };
  const existing = channelDefinitions(board);
  const updated = await Community.findOneAndUpdate({ _id: id, ownerId: userId, updatedAt: board.updatedAt }, { $set: { channels: [...existing, channel] } }, { new: true, runValidators: true });
  if (!updated) fail('The community changed. Please try again.', 409);
  return { channels: channelDefinitions(updated), defaultChannelId: 'general' };
}
async function editChannel(id, channelId, userId, data = {}) {
  const board = await getBoard(id); mustOwn(board, userId); getChannel(board, channelId);
  if (channelId === 'welcome') fail('The welcome channel is managed through community rules.');
  const changes = {};
  if ('name' in data) {
    changes.name = bounded(data.name, 'Channel name', 2, 32).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(changes.name)) fail('Use lowercase letters, numbers, and hyphens for channel names.');
    if (channelDefinitions(board).some(item => item.id !== channelId && item.name === changes.name)) fail('That channel name already exists.', 409);
  }
  if ('topic' in data) changes.topic = bounded(data.topic, 'Channel topic', 0, 160);
  if ('readOnly' in data) { if (typeof data.readOnly !== 'boolean') fail('Read-only must be on or off.'); changes.readOnly = data.readOnly; }
  const channels = channelDefinitions(board).map(item => item.id === channelId ? { ...item, ...changes } : item);
  const updated = await Community.findOneAndUpdate({ _id: id, ownerId: userId, updatedAt: board.updatedAt }, { $set: { channels } }, { new: true, runValidators: true });
  if (!updated) fail('The community changed. Please try again.', 409);
  return { channels: channelDefinitions(updated), defaultChannelId: 'general' };
}
async function editRules(id, userId, data = {}) {
  const board = await getBoard(id); mustOwn(board, userId);
  if (!Array.isArray(data.rules) || data.rules.length < 1 || data.rules.length > 10) fail('Add 1–10 clear community rules.');
  const rules = data.rules.map(rule => bounded(rule, 'Each rule', 3, 240));
  if ('requireRulesAcceptance' in data && typeof data.requireRulesAcceptance !== 'boolean') fail('Rules acknowledgement must be on or off.');
  const updated = await Community.findOneAndUpdate({ _id: id, ownerId: userId }, { $set: { rules, requireRulesAcceptance: data.requireRulesAcceptance === true }, $inc: { rulesVersion: 1 } }, { new: true, runValidators: true });
  if (!updated) fail('Community not found.', 404);
  return { rules: updated.rules, rulesVersion: updated.rulesVersion, requiresRulesAcceptance: updated.requireRulesAcceptance };
}
async function getMembers(id, userId) {
  const board = await getBoard(id); mustBelong(board, userId);
  const members = (board.members || []).filter(value => mongoose.isObjectIdOrHexString(value));
  const users = await User.find({ _id: { $in: members } }).select('username fullname avatar').limit(200).lean();
  return { total: members.length, members: users.map(user => ({ _id: String(user._id), username: user.username, fullname: user.fullname, avatar: user.avatar || '', role: String(board.ownerId) === String(user._id) ? 'owner' : 'member' })) };
}
module.exports = { EMOJIS, channelDefinitions, validateMessage, assertPostingRules, createChannelMessage, getChannelMessages, toggleMessageReaction, createChannel, editChannel, editRules, getMembers };
