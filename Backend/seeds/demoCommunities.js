const crypto = require('node:crypto');
const Community = require('../model/Community');

const demoBoards = [
  { demoKey: 'technology', name: 'Technology', board: 'g', category: 'Technology', icon: '⌘', accent: '#40c9e5',
    description: 'Hardware rabbit holes, open source finds, and the ideas moving technology forward.',
    discussion: ['What are you building this week?', 'Share a side project, a tiny tool, or an idea you cannot stop thinking about. Work in progress is welcome.'] },
  { demoKey: 'gaming', name: 'Gaming', board: 'v', category: 'Gaming', icon: '✚', accent: '#b5dc78',
    description: 'From indie discoveries to late-night co-op. Find your next game and your people.',
    discussion: ['The one game you wish more people played', 'Tell us about an overlooked game and what makes it special. Keep spoilers clearly marked.'] },
  { demoKey: 'music', name: 'Music', board: 'mu', category: 'Music', icon: '♫', accent: '#ffc77d',
    description: 'Album deep dives, new releases, listening rooms, and sounds worth passing on.',
    discussion: ['One album, no skips', 'What record deserves a front-to-back listen? Share the artist, album, and the moment it clicked for you.'] },
  { demoKey: 'film', name: 'Film & Television', board: 'tv', category: 'Film & TV', icon: '▤', accent: '#f49ca4',
    description: 'Big-screen obsessions, small-screen discoveries, and thoughtful conversations after the credits.',
    discussion: ['What did you watch recently?', 'Drop a recommendation and a spoiler-free reason to watch. The obscure picks are just as welcome as the classics.'] },
  { demoKey: 'creative', name: 'Creative Studio', board: 'ic', category: 'Art & Design', icon: '✳', accent: '#98b9ff',
    description: 'Sketches, design experiments, photography, and useful feedback for your next creation.',
    discussion: ['Open studio: share a work in progress', 'Show something unfinished and tell us what kind of feedback would help. Constructive, specific critique only.'] },
];

async function seedDemoCommunities() {
  for (const { discussion, ...board } of demoBoards) {
    await Community.updateOne({ demoKey: board.demoKey }, { $setOnInsert: {
      ...board, isDemo: true, members: [], ownerId: null,
      inviteToken: crypto.randomBytes(24).toString('hex'),
      discussions: [{ title: discussion[0], content: discussion[1], authorName: 'DailyCollabs', isDemo: true }],
    } }, { upsert: true, runValidators: true });
  }
}

module.exports = { seedDemoCommunities, demoBoards };
