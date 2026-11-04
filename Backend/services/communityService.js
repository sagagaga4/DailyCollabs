const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Community = require('../model/Community');
const User = require('../model/User');
const Message = require('../model/CommunityMessage');
const channelService = require('./communityChannels');

class CommunityError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function validId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new CommunityError('Community not found', 404);
}

function text(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new CommunityError(`${label} must be ${min}–${max} characters.`);
  }
  return value.trim();
}

function serialize(community, userId, includeDiscussions = false) {
  const item = community.toObject ? community.toObject() : community;
  const members = item.members || [];
  const own = Boolean(userId && item.ownerId && String(item.ownerId) === String(userId));
  const acknowledgements = item.rulesAcknowledgements;
  const acknowledgement = typeof acknowledgements?.get === 'function' ? acknowledgements.get(String(userId)) : acknowledgements?.[String(userId)];
  const hasAcceptedRules = own || !item.requireRulesAcceptance || acknowledgement?.version === (item.rulesVersion || 1);
  const result = {
    _id: item._id, name: item.name, description: item.description,
    board: item.board || 'community', category: item.category || 'Other', icon: item.icon || '◎',
    accent: /^#[0-9a-f]{6}$/i.test(item.accent || '') ? item.accent : '#41c8e8',
    isDemo: Boolean(item.isDemo), memberCount: members.length,
    discussionCount: (item.discussions || []).length, isMember: Boolean(userId && members.includes(String(userId))),
    isOwner: own, createdAt: item.createdAt, rules: item.rules || [],
    rulesVersion: item.rulesVersion || 1, requiresRulesAcceptance: Boolean(item.requireRulesAcceptance),
    hasAcceptedRules, needsRulesAcceptance: Boolean(item.requireRulesAcceptance && userId && members.includes(String(userId)) && !hasAcceptedRules),
    channels: channelService.channelDefinitions(item), defaultChannelId: 'general',
  };
  if (includeDiscussions) result.discussions = (item.discussions || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return result;
}

async function requireCommunity(id, withToken = false) {
  validId(id);
  const query = Community.findById(id).select('+rulesAcknowledgements');
  if (withToken) query.select('+inviteToken');
  const community = await query;
  if (!community) throw new CommunityError('Community not found', 404);
  return community;
}

async function requireUser(userId) {
  const user = await User.findById(userId).select('username fullname');
  if (!user) throw new CommunityError('Please sign in again.', 401);
  return user;
}

async function getAllCommunities(filters = {}, userId) {
  const communities = await Community.find().select('+rulesAcknowledgements').sort({ isDemo: -1, createdAt: -1 });
  const counts = communities.length ? await Message.aggregate([{ $match: { communityId: { $in: communities.map(item => item._id) } } }, { $group: { _id: '$communityId', count: { $sum: 1 } } }]) : [];
  const messageCounts = new Map(counts.map(item => [String(item._id), item.count]));
  const query = String(filters.search || filters.name || '').trim().slice(0, 100).toLowerCase();
  return communities.map(item => ({ ...serialize(item, userId), messageCount: (item.discussions || []).length + (messageCounts.get(String(item._id)) || 0) })).filter(item => (
    (!query || `${item.name} ${item.description} ${item.category} ${item.board}`.toLowerCase().includes(query)) &&
    (filters.joined !== 'true' || item.isMember)
  ));
}

async function getCommunityById(id, userId) {
  const community = await requireCommunity(id);
  return { ...serialize(community, userId, true), messageCount: (community.discussions || []).length + await Message.countDocuments({ communityId: id }) };
}

async function createCommunity(data = {}, userId) {
  await requireUser(userId);
  const name = text(data.name, 'Community name', 3, 60);
  const description = text(data.description, 'Description', 10, 500);
  const category = text(data.category || 'Other', 'Category', 2, 40);
  const board = (data.board || name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'new');
  if (typeof board !== 'string' || !/^[a-z0-9]{1,12}$/i.test(board)) throw new CommunityError('Board code must contain 1–12 letters or numbers.');
  const community = await Community.create({
    name, description, category, board: board.toLowerCase(),
    ownerId: userId, members: [String(userId)], inviteToken: crypto.randomBytes(24).toString('hex'),
  });
  return serialize(community, userId, true);
}

async function addMember(communityId, userId, inviteToken, acknowledgement = {}) {
  await requireUser(userId);
  const community = await requireCommunity(communityId, Boolean(inviteToken));
  if (inviteToken && inviteToken !== community.inviteToken) throw new CommunityError('This invitation is no longer valid.', 400);
  const alreadyJoined = (community.members || []).includes(String(userId));
  if (!alreadyJoined && community.requireRulesAcceptance && (acknowledgement.acceptedRules !== true || acknowledgement.rulesVersion !== community.rulesVersion)) throw new CommunityError('Read and accept the current community rules before joining.', 409);
  const update = { $addToSet: { members: String(userId) } };
  if (acknowledgement.acceptedRules === true && acknowledgement.rulesVersion !== (community.rulesVersion || 1)) throw new CommunityError('The community rules changed. Read them again before joining.', 409);
  if (acknowledgement.acceptedRules === true) update.$set = { [`rulesAcknowledgements.${userId}`]: { version: community.rulesVersion || 1, acceptedAt: new Date() } };
  const updated = await Community.findOneAndUpdate({ _id: communityId, ...((!alreadyJoined && community.requireRulesAcceptance) || acknowledgement.acceptedRules === true ? { rulesVersion: community.rulesVersion } : {}) }, update, { new: true }).select('+rulesAcknowledgements');
  if (!updated) throw new CommunityError('The community rules changed. Read them again before joining.', 409);
  return serialize(updated, userId, true);
}

async function removeMember(communityId, userId) {
  const community = await requireCommunity(communityId);
  if (String(community.ownerId) === String(userId)) throw new CommunityError('The community creator remains a member.', 409);
  const updated = await Community.findByIdAndUpdate(communityId, { $pull: { members: String(userId) } }, { new: true });
  return serialize(updated, userId, true);
}

async function getInvite(communityId, userId) {
  let community = await requireCommunity(communityId, true);
  if (!(community.members || []).includes(String(userId))) throw new CommunityError('Join this community before inviting friends.', 403);
  if (!community.inviteToken) {
    const initialized = await Community.findOneAndUpdate(
      { _id: communityId, $or: [{ inviteToken: { $exists: false } }, { inviteToken: null }, { inviteToken: '' }] },
      { $set: { inviteToken: crypto.randomBytes(24).toString('hex') } }, { new: true },
    ).select('+inviteToken');
    community = initialized || await requireCommunity(communityId, true);
  }
  return { token: community.inviteToken, communityId: community._id, communityName: community.name };
}

async function createDiscussion(communityId, userId, data = {}) {
  await channelService.assertPostingRules(communityId, userId, 'general');
  const user = await requireUser(userId);
  const discussion = {
    title: text(data.title, 'Discussion title', 3, 120),
    content: text(data.content, 'Your message', 3, 3000),
    authorId: userId, authorName: user.username,
  };
  const updated = await Community.findOneAndUpdate({ _id: communityId, members: String(userId) },
    { $push: { discussions: { $each: [discussion], $position: 0, $slice: 200 } } },
    { new: true, runValidators: true });
  if (!updated) throw new CommunityError('Join this community to start a conversation.', 403);
  return serialize(updated, userId, true);
}

async function deleteCommunity(id, userId) {
  const community = await requireCommunity(id);
  if (!community.ownerId || String(community.ownerId) !== String(userId)) throw new CommunityError('Only the community creator can delete it.', 403);
  await Community.deleteOne({ _id: community._id, ownerId: userId });
  return { message: 'Community deleted' };
}

module.exports = { CommunityError, serialize, getAllCommunities, getCommunityById, createCommunity, addMember, removeMember, getInvite, createDiscussion, deleteCommunity, ...channelService };
