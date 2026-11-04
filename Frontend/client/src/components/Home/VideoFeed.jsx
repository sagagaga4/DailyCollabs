import { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import { parseVideoUrl } from '../../lib/media';
import VideoPlayer from './VideoPlayer';
import { DraggableCard, CommunityTags } from '../CardActions';
import { BOOKMARK_EVENT, readBookmarks, toggleBookmark } from '../../lib/bookmarks';

const EXAMPLES = [
  { _id: 'sample-design', title: 'A little inspiration goes a long way', caption: 'Explore how small creative ideas can turn into something remarkable.', videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', author: { username: 'Blender Foundation' }, sample: true },
  { _id: 'sample-openfilm', title: 'Made together. Shared with everyone.', caption: 'Sintel — an independent open movie from the Blender Foundation.', videoUrl: 'https://www.youtube.com/watch?v=eRsGyueVLvQ', author: { username: 'Blender Foundation' }, sample: true },
];

function getCurrentUserId() {
  try {
    const token = sessionStorage.getItem('token');
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).id;
  } catch { return null; }
}

export default function VideoFeed({ compact = false, autoplayMuted = false }) {
  const [savedBookmarks, setSavedBookmarks] = useState(readBookmarks);
  useEffect(() => { const sync = event => setSavedBookmarks(event.detail || readBookmarks()); window.addEventListener(BOOKMARK_EVENT, sync); return () => window.removeEventListener(BOOKMARK_EVENT, sync); }, []);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [transcript, setTranscript] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const currentUserId = getCurrentUserId();
  const parsed = parseVideoUrl(videoUrl);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`${API_URL}/media`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Videos are temporarily unavailable.');
        const data = await response.json();
        if (!Array.isArray(data.posts)) throw new Error('Could not read the video feed.');
        setPosts(data.posts);
        setPage(1);
        setHasMore(Boolean(data.hasMore));
        setLoadError('');
      })
      .catch((failure) => { if (failure.name !== 'AbortError') setLoadError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  async function publish(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const token = sessionStorage.getItem('token');
    if (!token) return setError('Please sign in before sharing a video.');
    if (!parsed) return setError('Use a YouTube, Vimeo, or direct HTTPS MP4/WebM link.');
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, caption, transcript, videoUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not share this video.');
      setPosts((previous) => [data, ...previous]);
      setTitle(''); setCaption(''); setTranscript(''); setVideoUrl(''); setComposerOpen(false);
      setNotice('Your video is live.');
    } catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const response = await fetch(`${API_URL}/media?page=${page + 1}`);
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.posts)) throw new Error('Could not load more videos.');
      setPosts((previous) => [...previous, ...data.posts.filter((post) => !previous.some((existing) => existing._id === post._id))]);
      setPage(data.page); setHasMore(Boolean(data.hasMore)); setLoadError('');
    } catch (failure) { setLoadError(failure.message); }
    finally { setLoadingMore(false); }
  }

  async function remove(post) {
    if (!window.confirm(`Remove “${post.title}” from the feed?`)) return;
    setDeleting(post._id);
    setError('');
    try {
      const response = await fetch(`${API_URL}/media/${post._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not remove video.');
      setPosts((previous) => previous.filter((item) => item._id !== post._id));
      setNotice('Video removed.');
    } catch (failure) { setError(failure.message); }
    finally { setDeleting(null); }
  }

  const showingExamples = !posts.length;
  const displayed = (showingExamples ? EXAMPLES : posts).slice(0, compact ? 2 : undefined);

  return (
    <section className="home-video-section" aria-labelledby="home-video-heading">
      <div className="home-section-heading">
        <div><span className="home-eyebrow">PRESS PLAY</span><h2 id="home-video-heading">Worth a watch<span className="home-heading-dot">.</span></h2></div>
        <button className="home-secondary-button" onClick={() => { setComposerOpen(!composerOpen); setError(''); }}>{composerOpen ? 'Close composer' : '+ Share a video'}</button>
      </div>
      {composerOpen && (
        <form className="home-video-composer" onSubmit={publish}>
          <h3>Start a conversation with a video</h3>
          <p>YouTube, Vimeo, or a direct HTTPS MP4 / WebM link.</p>
          <label htmlFor="home-video-url">Video link</label>
          <input id="home-video-url" type="url" required maxLength={2048} value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus />
          {videoUrl && <span className={`home-url-validation ${parsed ? 'is-valid' : ''}`}>{parsed ? `✓ ${parsed.label} link ready` : 'Add a supported HTTPS video link.'}</span>}
          <label htmlFor="home-video-title">Title</label>
          <input id="home-video-title" required minLength={3} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What makes this worth watching?" />
          <label htmlFor="home-video-caption">Your take <span>(optional)</span></label>
          <textarea id="home-video-caption" maxLength={500} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Add some context for the community…" rows={3} />
          <details className="home-transcript-composer">
            <summary>Add a transcript or visual description</summary>
            <label htmlFor="home-video-transcript">Transcript <span>(optional)</span></label>
            <textarea id="home-video-transcript" maxLength={8000} value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Help everyone follow along. Include the spoken words and any important visual details." rows={5} />
            <span className="home-transcript-counter">{transcript.length.toLocaleString()}/8,000</span>
          </details>
          <div className="home-composer-footer"><span>{caption.length}/500</span><button className="home-primary-button" disabled={saving || !parsed || title.trim().length < 3}>{saving ? 'Sharing…' : 'Share video ↗'}</button></div>
        </form>
      )}
      {notice && <p className="home-feed-notice" role="status">{notice}</p>}
      {error && <p className="home-feed-error" role="alert">{error}</p>}
      {loadError && <p className="home-feed-error" role="status">{loadError} <button onClick={() => setRefresh((value) => value + 1)}>Try again</button>{showingExamples && ' Showing sample videos below.'}</p>}
      {loading ? <div className="home-video-loading" role="status">Loading the video feed…</div> : (
        <>
          {showingExamples && <p className="home-sample-note">A little inspiration to get started. These are sample videos; share one to start your community feed.</p>}
          <div className="home-video-grid">
            {displayed.map((post) => (
              <DraggableCard key={post._id} content={{ title: post.title, url: post.videoUrl, description: post.caption || '', type: 'video' }}><article className="home-video-card">
                <VideoPlayer url={post.videoUrl} title={post.title} autoplayMuted={autoplayMuted} loop={autoplayMuted && post.sample} />
                <div className="home-video-card-body">
                  <div className="home-video-card-meta"><span>{post.sample ? 'SAMPLE VIDEO' : `@${post.author?.username || 'member'}`}</span>{post.createdAt && <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}</div>
                  <h3 dir="auto">{post.title}</h3>
                  {post.caption && <p dir="auto">{post.caption}</p>}
                  <CommunityTags content={{ title: post.title, url: post.videoUrl, description: post.caption || '', type: 'video' }} />
                  <button type="button" className="home-video-save" onClick={() => toggleBookmark({ ...post, type: 'video' }).catch(failure => setError(failure.message))}>{savedBookmarks.some(item => item.link === post.videoUrl) ? 'Saved to bookmarks ✓' : 'Save video ◇'}</button>
                  {post.transcript && <details className="home-video-transcript"><summary>Read transcript</summary><div>{post.transcript}</div></details>}
                  <div className="home-video-card-footer"><a href={post.videoUrl} target="_blank" rel="noopener noreferrer">Open original ↗</a>{!post.sample && post.author?._id === currentUserId && <button disabled={deleting === post._id} onClick={() => remove(post)}>{deleting === post._id ? 'Removing…' : 'Remove'}</button>}</div>
                </div>
              </article></DraggableCard>
            ))}
          </div>
          {!compact && hasMore && <button className="home-secondary-button home-load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more videos'}</button>}
          <p className="home-video-privacy">{autoplayMuted ? 'Videos play muted while in view. Unmute to listen; scrolling away pauses playback.' : 'Your feed, your pace. Embedded players load when you choose to watch.'}</p>
        </>
      )}
    </section>
  );
}
