/** Keep delayed visibility-pause acknowledgements distinct from a viewer's pause. */
export function createPlaybackIntent(now = () => Date.now()) {
  let desired = 'paused';
  let expectedPauseUntil = 0;
  let pausedByUser = false;
  return {
    pauseAutomatically() { desired = 'paused'; expectedPauseUntil = now() + 2000; },
    playAutomatically() { desired = 'playing'; },
    playExplicitly() { pausedByUser = false; desired = 'playing'; },
    canResume() { return !pausedByUser; },
    playing(visible = true) {
      if (!visible) { desired = 'paused'; expectedPauseUntil = now() + 2000; return 'pause'; }
      pausedByUser = false;
      return 'playing';
    },
    paused(visible) {
      if (expectedPauseUntil && now() <= expectedPauseUntil) {
        expectedPauseUntil = 0;
        return visible && desired === 'playing' && !pausedByUser ? 'resume' : 'automatic';
      }
      expectedPauseUntil = 0;
      if (!visible || desired === 'paused') return 'automatic';
      pausedByUser = true;
      return 'user';
    },
  };
}

// Only pass media derived from parseVideoUrl's allowlist, never iframe HTML.
export function playbackEmbedUrl(media, { autoplayMuted = false, loop = false, origin = '' } = {}) {
  if (!media?.embedUrl) return null;
  const url = new URL(media.embedUrl);
  url.searchParams.set('autoplay', '0'); // Viewport readiness, rather than page load, starts playback.
  url.searchParams.set('controls', '1');
  url.searchParams.set('playsinline', '1');
  if (media.provider === 'youtube') {
    url.searchParams.set('enablejsapi', '1');
    url.searchParams.set('mute', autoplayMuted ? '1' : '0');
    if (/^https?:\/\//.test(origin)) url.searchParams.set('origin', origin);
    if (loop) { url.searchParams.set('loop', '1'); url.searchParams.set('playlist', media.id); }
  } else if (media.provider === 'vimeo') {
    url.searchParams.set('muted', autoplayMuted ? '1' : '0');
    url.searchParams.set('loop', loop ? '1' : '0');
  }
  return url.href;
}

let youtubeApi;
let vimeoApi;
export function loadVideoApi(provider) {
  if (provider === 'youtube' && window.YT?.Player) return Promise.resolve(window.YT);
  if (provider === 'vimeo' && window.Vimeo?.Player) return Promise.resolve(window.Vimeo);
  if (provider === 'youtube' && youtubeApi) return youtubeApi;
  if (provider === 'vimeo' && vimeoApi) return vimeoApi;
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => reject(new Error('Player controls did not load.')), 15000);
    const done = api => { clearTimeout(timeout); resolve(api); };
    script.async = true;
    script.onerror = () => { clearTimeout(timeout); reject(new Error('Player controls could not load.')); };
    if (provider === 'youtube') {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); done(window.YT); };
      script.src = 'https://www.youtube.com/iframe_api';
    } else {
      script.src = 'https://player.vimeo.com/api/player.js';
      script.onload = () => done(window.Vimeo);
    }
    document.head.appendChild(script);
  });
  if (provider === 'youtube') youtubeApi = promise;
  else vimeoApi = promise;
  return promise;
}
