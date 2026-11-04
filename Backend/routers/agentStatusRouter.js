const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const router = express.Router();
const statusDir = path.join(__dirname, '../agent-progress');
const missions = [
  { id: 1, name: 'Search & discovery', short: 'Search', icon: '◈', mission: 'Find topic-relevant stories and videos with a playful pixel search companion.', scope: 'Topic search · YouTube · Pixel motion' },
  { id: 2, name: 'Welcome experience', short: 'Welcome', icon: '◎', mission: 'Create a cinematic first impression with original artwork and a laptop product film.', scope: 'Landing page · Product film · Motion' },
  { id: 3, name: 'Community spaces', short: 'Communities', icon: '◇', mission: 'Build channel-based communities, editable rules, original emojis, and a sharper visual identity.', scope: 'Channels · Rules · Custom emojis' },
  { id: 4, name: 'Connected content', short: 'Content', icon: '▷', mission: 'Connect every story and video to communities, personal reposts, and sharing actions.', scope: 'Community tags · Drag actions · Sharing' },
];
function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(statusDir, name), 'utf8')); } catch { return fallback; }
}
function researchFor(id) {
  try {
    const note = fs.readFileSync(path.join(__dirname, `../../research/agent-${id}.md`), 'utf8');
    const sources = [...note.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map(match => ({ title: match[1], url: match[2] }));
    const domains = new Set(sources.map(source => new URL(source.url).hostname.split('.').slice(-2).join('.')));
    return { siteCount: domains.size, sources };
  } catch { return { siteCount: 0, sources: [] }; }
}
function snapshot() {
  return { serverTime: new Date().toISOString(), agents: missions.map(mission => ({ ...mission,
    ...readJson(`agent-${mission.id}.json`, { status: 'queued', progress: 0, message: 'Waiting for a mission update.', events: [] }), research: researchFor(mission.id) })),
    monitor: readJson('quality.json', { status: 'starting', checks: [], message: 'Waiting for the first automatic check.' }) };
}
router.get('/', (req, res) => { res.set('Cache-Control', 'no-store'); res.json(snapshot()); });
router.get('/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  let previous;
  const send = () => {
    const state = snapshot();
    const key = JSON.stringify({ agents: state.agents, monitor: state.monitor });
    if (key !== previous) { res.write(`data: ${JSON.stringify(state)}\n\n`); previous = key; }
    else res.write(': heartbeat\n\n');
  };
  send();
  const timer = setInterval(send, 1500);
  req.on('close', () => clearInterval(timer));
});
module.exports = router;
