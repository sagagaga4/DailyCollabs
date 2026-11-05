import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseVideoUrl } from '../../lib/media';
import { createPlaybackIntent, loadVideoApi, playbackEmbedUrl } from '../../lib/videoPlayback';
import ArticleArtwork from '../Artwork/ArticleArtwork';
import { usePageActive } from '../Navigation/PageActivity';
import './VideoPlayer.css';

const AUDIO_FOCUS = 'dailycollabs:video-audio-focus';

function Playback({ media, title, poster, autoplayMuted, loop }) {
  const pageActive = usePageActive();
  const pageActiveRef = useRef(pageActive); pageActiveRef.current = pageActive;
  const root = useRef(null);
  const frameHost = useRef(null);
  const native = useRef(null);
  const controls = useRef(null);
  const identity = useRef({});
  const mutedChoice = useRef(autoplayMuted);
  const visibleNow = useRef(false);
  const intent = useMemo(() => createPlaybackIntent(), []);
  const [muted, setMuted] = useState(autoplayMuted);
  const [entered, setEntered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [manual, setManual] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playbackState, setPlaybackState] = useState('idle');
  const loaded = autoplayMuted ? entered : manual;

  function rememberMute(value) {
    mutedChoice.current = value; setMuted(value);
    if (!value) window.dispatchEvent(new CustomEvent(AUDIO_FOCUS, { detail: identity.current }));
  }

  useEffect(() => {
    let intersecting = false;
    const update = () => {
      const active = pageActive && intersecting && !document.hidden;
      visibleNow.current = active; setVisible(active);
      if (active) setEntered(true);
    };
    update();
    const observer = new IntersectionObserver(entries => { intersecting = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.35; update(); }, { threshold: [0, 0.35] });
    observer.observe(root.current);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, [pageActive]);

  useEffect(() => {
    const audioFocus = event => {
      if (event.detail === identity.current) return;
      mutedChoice.current = true; setMuted(true);
      controls.current?.mute(true);
    };
    window.addEventListener(AUDIO_FOCUS, audioFocus);
    return () => window.removeEventListener(AUDIO_FOCUS, audioFocus);
  }, []);

  const requestPlayerPlay = useCallback(() => {
    if (!controls.current) return;
    try { Promise.resolve(controls.current.play()).catch(() => setBlocked(true)); } catch { setBlocked(true); }
  }, []);
  const handlePause = useCallback(() => {
    setPlaybackState('paused');
    if (intent.paused(visibleNow.current && pageActiveRef.current) === 'resume') requestPlayerPlay();
  }, [intent, requestPlayerPlay]);
  const handlePlaying = useCallback(() => {
    setPlaybackState('playing');
    // A pending play request can finish after scrolling away or hiding the tab.
    if (intent.playing(visibleNow.current && pageActiveRef.current) === 'pause') { controls.current?.pause(); return; }
    setBlocked(false);
  }, [intent]);

  useEffect(() => {
    if (!loaded || media.provider === 'file') return;
    setReady(false);
    let disposed = false;
    const host = frameHost.current;
    const iframe = document.createElement('iframe');
    iframe.src = playbackEmbedUrl(media, { autoplayMuted, loop, origin: window.location.origin });
    iframe.title = title;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    host.appendChild(iframe);
    let player;
    let poll;
    loadVideoApi(media.provider).then(api => {
      if (disposed) return;
      if (media.provider === 'youtube') {
        player = new api.Player(iframe, { events: {
          onReady: event => {
            if (disposed) return;
            const target = event.target;
            controls.current = { play: () => target.playVideo(), pause: () => target.pauseVideo(), mute: value => value ? target.mute() : target.unMute() };
            controls.current.mute(mutedChoice.current); setReady(true);
            // YouTube has no volume-change event; mirror its built-in controls.
            poll = setInterval(() => {
              if (disposed || !visibleNow.current) return;
              const value = target.isMuted() || target.getVolume() === 0;
              if (value !== mutedChoice.current) rememberMute(value);
            }, 700);
          },
          onStateChange: event => { if (disposed) return; if (event.data === 1) handlePlaying(); else if (event.data === 2) handlePause(); else setPlaybackState(({ '-1': 'unstarted', 0: 'ended', 3: 'buffering', 5: 'ready' })[event.data] || 'idle'); },
          onAutoplayBlocked: () => { if (!disposed) { setBlocked(true); setPlaybackState('blocked'); } },
          onError: () => { if (!disposed) { setFailed(true); setPlaybackState('error'); } },
        } });
      } else {
        player = new api.Player(iframe);
        controls.current = { play: () => player.play(), pause: () => player.pause().catch(() => {}), mute: value => player.setMuted(value).catch(() => {}) };
        player.ready().then(() => { if (!disposed) { controls.current.mute(mutedChoice.current); setReady(true); } }).catch(() => { if (!disposed) setFailed(true); });
        player.on('volumechange', data => { if (!disposed) rememberMute(data.muted ?? data.volume === 0); });
        player.on('play', () => { if (!disposed) handlePlaying(); });
        player.on('pause', () => { if (!disposed) handlePause(); });
        player.on('ended', () => { if (!disposed) setPlaybackState('ended'); });
        player.on('bufferstart', () => { if (!disposed) setPlaybackState('buffering'); });
        player.on('bufferend', () => { player.getPaused().then(paused => { if (!disposed) setPlaybackState(paused ? 'paused' : 'playing'); }).catch(() => {}); });
        player.on('error', () => { if (!disposed) { setFailed(true); setPlaybackState('error'); } });
      }
    }).catch(() => { if (!disposed) { setBlocked(true); setFailed(true); } });
    return () => {
      disposed = true; clearInterval(poll); controls.current = null;
      // The SDK owns this iframe; React owns only its host, so destroy cannot
      // remove a node React expects to reconcile during navigation or StrictMode.
      try { const result = player?.destroy?.(); result?.catch?.(() => {}); } catch { /* Frame may already be detached. */ }
      host.replaceChildren();
    };
  }, [loaded, media, autoplayMuted, loop, title, handlePause, handlePlaying]);

  useEffect(() => {
    if (!ready || !controls.current) return;
    if (!visible) { intent.pauseAutomatically(); controls.current.pause(); return; }
    if ((!autoplayMuted && !manual) || !intent.canResume()) return;
    intent.playAutomatically();
    requestPlayerPlay();
  }, [ready, visible, autoplayMuted, manual, intent, requestPlayerPlay]);

  function play() {
    intent.playExplicitly(); setManual(true);
    if (controls.current) { try { Promise.resolve(controls.current.play()).catch(() => setBlocked(true)); } catch { setBlocked(true); } }
  }
  function toggleSound() {
    const next = !mutedChoice.current;
    rememberMute(next); controls.current?.mute(next);
    if (!next) play();
  }

  return <div className="home-video-unit" ref={root} data-playback-state={playbackState}>
    <div className="home-video-player">
      {loaded ? media.provider === 'file' ? <video ref={native} controls playsInline preload="metadata" muted={muted} loop={loop} poster={poster || undefined} aria-label={title}
        onLoadedMetadata={() => { controls.current = { play: () => native.current.play(), pause: () => native.current.pause(), mute: value => { native.current.muted = value; } }; setReady(true); }}
        onPlaying={handlePlaying} onPause={handlePause} onEnded={() => setPlaybackState('ended')} onWaiting={() => setPlaybackState('buffering')} onVolumeChange={() => rememberMute(native.current.muted || native.current.volume === 0)} onError={() => { setFailed(true); setPlaybackState('error'); }}><source src={media.url} type={media.mimeType} />Your browser cannot play this video.</video>
        : <div className="home-provider-frame" ref={frameHost} />
        : autoplayMuted ? <div className="home-video-awaiting"><ArticleArtwork src={poster || media.thumbnailUrl} url={media.url} title={title} topic={title} variant="video" /><span className="home-video-provider">{media.label}</span></div>
          : <button type="button" className={`home-video-poster home-video-poster--${media.provider}`} onClick={play} aria-label={`Load ${title} on ${media.label}`}><ArticleArtwork src={poster || media.thumbnailUrl} url={media.url} title={title} topic={title} variant="video" /><span className="home-video-provider">{media.label}</span><span className="home-play-icon" aria-hidden="true">▶</span><span className="home-video-load-label">Watch video</span></button>}
      {failed && <p className="home-player-error">This video could not load. <a href={media.url} target="_blank" rel="noopener noreferrer">Open the original ↗</a></p>}
    </div>
    {autoplayMuted && <div className="home-video-playback-controls"><span>{failed ? 'Playback unavailable · open the original' : muted ? 'Autoplays muted · unmute to listen' : 'Sound on'}</span><div>{blocked && !failed && <button type="button" onClick={play}>Play video</button>}<button type="button" disabled={!ready || failed} onClick={toggleSound} aria-label={muted ? `Unmute ${title}` : `Mute ${title}`} aria-pressed={!muted}>{muted ? 'Unmute' : 'Mute'}</button></div></div>}
    {loaded && <div className="home-video-original"><a href={media.url} target="_blank" rel="noopener noreferrer">Watch on {media.label} ↗</a>{blocked && <span>Use the player’s play control if playback is blocked.</span>}</div>}
  </div>;
}

export default function VideoPlayer({ url, title = 'Video', poster, autoplayMuted = false, loop = false }) {
  const media = useMemo(() => parseVideoUrl(url), [url]);
  return media ? <Playback key={`${media.url}:${autoplayMuted}`} media={media} title={title} poster={poster} autoplayMuted={autoplayMuted} loop={loop} /> : null;
}
