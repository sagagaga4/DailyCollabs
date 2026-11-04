// Original DailyCollabs glyph registry. Keep the frontend JSON snapshot aligned in tests.
const registry = require('./communityEmojis.json');
const EMOJIS = registry.map(emoji => emoji.id);
function normalizeEmoji(value) {
  if (EMOJIS.includes(value)) return value;
  // The six original stored ids remain canonical, with :dc_name: aliases accepted.
  if (typeof value === 'string' && value.startsWith('dc_') && EMOJIS.slice(0, 6).includes(value.slice(3))) return value.slice(3);
  return null;
}
module.exports = { registry, EMOJIS, normalizeEmoji };
