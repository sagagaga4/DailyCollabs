// Precision comes before filling a row: an unmatched story should invite exploration.
const TOPICS = [
  { boards: ['g', 'tech', 'technology'], categories: ['technology', 'tech'], words: ['technology', 'tech', 'software', 'computer', 'computers', 'coding', 'code', 'developer', 'developers', 'programming', 'javascript', 'python', 'redis', 'database', 'databases', 'ai', 'openai', 'robotics', 'semiconductor', 'linux', 'hardware', 'cybersecurity', 'smartphone', 'processor', 'gpu'] },
  { boards: ['v', 'gaming', 'games'], categories: ['gaming', 'games'], words: ['game', 'games', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam', 'esports', 'minecraft', 'fortnite', 'gamer'] },
  { boards: ['mu', 'music'], categories: ['music'], words: ['music', 'musician', 'musicians', 'song', 'songs', 'album', 'albums', 'concert', 'guitar', 'jazz', 'playlist', 'singer', 'rapper', 'spotify'] },
  { boards: ['tv', 'film', 'movies'], categories: ['film', 'film & tv', 'movies', 'film & television'], words: ['film', 'films', 'movie', 'movies', 'cinema', 'television', 'netflix', 'animation', 'blender', 'documentary', 'hollywood', 'filmmaker', 'screenplay'] },
  { boards: ['ic', 'art', 'creative'], categories: ['creative', 'art', 'arts', 'creativity', 'art & design'], words: ['design', 'illustration', 'illustrator', 'drawing', 'photography', 'photographer', 'painting', 'painter', 'architecture', 'animation', 'blender', 'sculpture', 'ui', 'ux'] },
];
const GENERIC_LABELS = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'to', 'in', 'on', 'with', 'other', 'general', 'community', 'communities', 'people', 'share', 'sharing', 'create', 'creating', 'creative', 'media', 'video', 'videos', 'news', 'new', 'daily', 'my', 'your', 'our', 'all', 'more', 'club', 'board', 'hub', 'studio', 'space', 'room', 'builders', 'builder', 'collective', 'lounge', 'group', 'groups', 'team', 'teams', 'network', 'forum', 'forums', 'channel', 'members', 'friends', 'discussion', 'discussions', 'talk', 'world', 'today', 'story', 'stories', 'latest', 'post', 'posts', 'demo', 'sample', 'test']);
const tokens = (value) => String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [];

export function recommendCommunities(content, communities, limit = 2) {
  const titleTerms = new Set(tokens(content?.title));
  const descriptionTerms = new Set(tokens(content?.description));
  return (Array.isArray(communities) ? communities : []).map((community, index) => {
    const board = String(community.board || '').toLowerCase();
    const category = String(community.category || '').toLowerCase();
    const topic = TOPICS.find((item) => item.boards.includes(board) || item.categories.includes(category));
    // Custom communities can match their actual specific names/categories, never generic labels.
    const labels = tokens(`${community.name || ''} ${community.category || ''}`).filter((word) => word.length >= 3 && !GENERIC_LABELS.has(word));
    const anchors = new Set([...(topic?.words || []), ...labels]);
    const score = [...anchors].reduce((sum, word) => sum + (titleTerms.has(word) ? 2 : descriptionTerms.has(word) ? 1 : 0), 0);
    return { ...community, recommendationScore: score, order: index };
  }).filter((item) => item.recommendationScore > 0)
    .sort((a, b) => b.recommendationScore - a.recommendationScore || a.order - b.order)
    .slice(0, Math.max(0, limit));
}

export function toActionContent(input = {}) {
  let url;
  try { url = new URL(input.url || input.link); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2048) return null;
  let image = '';
  try {
    const candidate = new URL(input.image || '');
    if (['http:', 'https:'].includes(candidate.protocol) && !candidate.username && !candidate.password && candidate.href.length <= 2048) image = candidate.href;
  } catch { /* Artwork is optional. */ }
  return { type: input.type === 'video' ? 'video' : 'article', url: url.href, title: String(input.title || 'Untitled').replace(/\s+/g, ' ').trim().slice(0, 200) || 'Untitled', image, description: String(input.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 500) };
}
