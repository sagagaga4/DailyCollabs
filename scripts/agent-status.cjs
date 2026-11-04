const fs = require('node:fs');
const path = require('node:path');
const [id, status, progress, message] = process.argv.slice(2);
if (!/^[1-4]$/.test(id) || !['queued', 'building', 'checking', 'fixing', 'review', 'ready', 'blocked'].includes(status)) {
  console.error('Usage: node scripts/agent-status.cjs <1-4> <queued|building|checking|fixing|review|ready|blocked> <0-100> <message>');
  process.exit(1);
}
const dir = path.join(__dirname, '../Backend/agent-progress');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `agent-${id}.json`);
let previous = {};
try { previous = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first update */ }
const now = new Date().toISOString();
const next = { ...previous, id: Number(id), status, progress: Math.max(0, Math.min(100, Number(progress) || 0)), message, updatedAt: now,
  events: [...(previous.events || []), { status, message, at: now }].slice(-50) };
fs.writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2));
fs.renameSync(`${file}.tmp`, file);
console.log(`Agent ${id}: ${status} · ${message}`);
