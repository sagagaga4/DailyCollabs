const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  id: { type: String, required: true, maxlength: 32 },
  name: { type: String, required: true, maxlength: 32 },
  topic: { type: String, default: '', maxlength: 160 },
  type: { type: String, enum: ['text', 'welcome'], default: 'text' },
  readOnly: { type: Boolean, default: false },
}, { _id: false });
const defaultChannels = () => [
  { id: 'welcome', name: 'welcome-and-rules', topic: 'Start here. Get to know the community.', type: 'welcome', readOnly: true },
  { id: 'general', name: 'general', topic: 'Good conversations start here.', type: 'text', readOnly: false },
];

const discussionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  content: { type: String, required: true, trim: true, maxlength: 3000 },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
  authorName: { type: String, required: true },
  isDemo: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 60 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
  board: { type: String, trim: true, maxlength: 12, default: 'new' },
  category: { type: String, trim: true, maxlength: 40, default: 'Other' },
  icon: { type: String, maxlength: 8, default: '◎' },
  accent: { type: String, default: '#41c8e8' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
  members: [{ type: String }],
  inviteToken: { type: String, select: false },
  demoKey: { type: String },
  isDemo: { type: Boolean, default: false },
  rules: { type: [String], default: ['Be curious. Be respectful.', 'Keep conversations relevant to the community.', 'Share ideas, give credit, and avoid spam.'] },
  rulesVersion: { type: Number, default: 1 },
  requireRulesAcceptance: { type: Boolean, default: false },
  rulesAcknowledgements: { type: Map, of: new mongoose.Schema({ version: Number, acceptedAt: Date }, { _id: false }), select: false },
  channels: { type: [channelSchema], default: defaultChannels },
  discussions: { type: [discussionSchema], default: [] },
  aiMember: { type: String, default: 'DailyCollabs' },
  rssUrls: { type: [String], default: [] },
}, { timestamps: true });

communitySchema.index({ demoKey: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('community', communitySchema, 'Communities');
