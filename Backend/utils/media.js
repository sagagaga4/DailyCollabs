const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function parseVideoUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  let url;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
  const host = url.hostname.toLowerCase();
  let id;
  if (host === 'youtu.be' || host === 'www.youtu.be') id = url.pathname.split('/').filter(Boolean)[0];
  else if (YOUTUBE_HOSTS.has(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1];
  }
  if (id && VIDEO_ID.test(id)) return { provider: 'youtube', id, label: 'YouTube', url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&cc_load_policy=1`, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    const videoId = host === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : parts[0];
    if (/^\d{5,12}$/.test(videoId || '')) return { provider: 'vimeo', id: videoId, label: 'Vimeo', url: `https://vimeo.com/${videoId}`, embedUrl: `https://player.vimeo.com/video/${videoId}?dnt=1&playsinline=1` };
  }
  if (/\.(mp4|webm)$/i.test(url.pathname) && !['localhost', '127.0.0.1', '[::1]'].includes(host) && !host.endsWith('.local')) return { provider: 'file', label: 'Video', url: url.href, mimeType: /\.webm$/i.test(url.pathname) ? 'video/webm' : 'video/mp4' };
  return null;
}

function extractFeedVideo(item) {
  const content = item?.['media:content'] || item?.mediaGroup?.['media:content'];
  const mediaItems = Array.isArray(content) ? content : content ? [content] : [];
  const candidates = [item?.videoUrl, item?.enclosure?.url, ...mediaItems.map((entry) => entry?.$?.url || entry?.url), item?.mediaGroup?.['media:player']?.$?.url, item?.link];
  for (const value of candidates) {
    const media = parseVideoUrl(value);
    if (media) return media;
  }
  return null;
}

function validateMediaInput(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const caption = typeof body?.caption === 'string' ? body.caption.trim() : '';
  const transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : '';
  const media = parseVideoUrl(body?.videoUrl);
  if (title.length < 3 || title.length > 140) return { error: 'Use a title between 3 and 140 characters.' };
  if (caption.length > 500) return { error: 'Keep the caption under 500 characters.' };
  if (transcript.length > 8000) return { error: 'Keep the transcript under 8,000 characters.' };
  if (!media) return { error: 'Add an HTTPS YouTube, Vimeo, MP4, or WebM video URL.' };
  return { value: { title, caption, transcript, videoUrl: media.url, provider: media.provider } };
}

module.exports = { parseVideoUrl, extractFeedVideo, validateMediaInput };
