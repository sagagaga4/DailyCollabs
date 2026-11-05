import { useEffect, useMemo, useState } from 'react';
import { DraggableCard, CommunityTags } from '../CardActions';
import { WhyThisStory } from '../FeedControls/FeedControls';
import { BOOKMARK_EVENT, readBookmarks, toggleBookmark } from '../../lib/bookmarks';
import { canonicalThreadUrl } from '../Comments/commentThreads';
import VideoPlayer from './VideoPlayer';
import { normalizeMixedVideo } from './mixedFeed';
import { contentRequest } from '../CardActions/contentApi';
import './MixedVideoCard.css';

function viewerId() { try { const token = sessionStorage.getItem('token'); return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).id || null; } catch { return null; } }

export default function MixedVideoCard({ item, autoplayMuted = false, onError, onFeedback, feedbackBusy = false, onOpen, onDeleted }) {
  const video = useMemo(() => normalizeMixedVideo(item), [item]);
  const [bookmarks, setBookmarks] = useState(readBookmarks);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = (event) => setBookmarks(event.detail || readBookmarks());
    window.addEventListener(BOOKMARK_EVENT, sync);
    return () => window.removeEventListener(BOOKMARK_EVENT, sync);
  }, []);
  if (!video) return null;
  const saved = bookmarks.some((entry) => canonicalThreadUrl(entry.link) === video.videoUrl);
  const content = { title: video.title, url: video.videoUrl, image: video.thumbnailUrl, description: video.caption || video.channel, type: 'video' };
  const date = Date.parse(video.published);
  const ownPostId = video.author?._id === viewerId() && /^[a-f0-9]{24}$/i.test(video._id || '') ? video._id : null;
  const sharedAuthor = video.author?.username ? `@${video.author.username}` : '';
  const displayDate = Number.isNaN(date) ? video.published : new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  async function save() {
    setSaving(true); setError('');
    try { await toggleBookmark({ ...video, image: video.thumbnailUrl, pubDate: video.published, description: video.caption || video.channel, type: 'video' }); }
    catch (failure) { setError(failure.message); onError?.(failure.message, video); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!window.confirm('Remove the video you shared?')) return;
    setDeleting(true); setError('');
    try { await contentRequest(`/media/${ownPostId}`, { method: 'DELETE' }); window.dispatchEvent(new CustomEvent('dailycollabs:media', { detail: { action: 'removed', id: ownPostId } })); onDeleted?.(video); }
    catch (failure) { setError(failure.message); onError?.(failure.message, video); }
    finally { setDeleting(false); }
  }
  function opened() { try { Promise.resolve(onOpen?.(video)).catch(() => {}); } catch { /* An optional learning signal must not block opening the source. */ } }
  async function feedback(type) {
    setError('');
    try { await onFeedback?.(type, video); }
    catch (failure) { setError(failure.message); onError?.(failure.message, video); }
  }

  return <div className="card-content mixed-video-slot"><DraggableCard content={content}>
    <article className="mixed-video-card">
      <div className="mixed-video-topline"><span className="mixed-video-type"><span aria-hidden="true">▷</span> VIDEO</span>{video.duration && <span className="mixed-video-duration">{video.duration}</span>}</div>
      <VideoPlayer url={video.videoUrl} title={video.title} poster={video.thumbnailUrl} autoplayMuted={autoplayMuted} />
      <div className="mixed-video-body"><div className="mixed-video-source"><span dir="auto">{sharedAuthor ? `Shared by ${sharedAuthor}` : video.channel || video.provider}</span>{displayDate && <time dateTime={Number.isNaN(date) ? undefined : video.published} dir="auto">{displayDate}</time>}</div>
        <h3 dir="auto" lang={video.language || undefined}>{video.title}</h3>
        {sharedAuthor && video.channel && video.channel.replace(/^@/, '') !== video.author.username && <p className="mixed-video-creator" dir="auto">{video.channel}</p>}
        {video.caption && <p className="mixed-video-caption" dir="auto">{video.caption}</p>}
        {video.transcript && <details className="mixed-video-transcript"><summary>Read transcript</summary><p dir="auto">{video.transcript}</p></details>}
        <WhyThisStory reasons={video.reasons} />
        <CommunityTags content={content} />
        {error && <p className="mixed-video-error" role="alert">{error}</p>}
        <div className="mixed-video-actions"><a href={video.videoUrl} target="_blank" rel="noopener noreferrer" onClick={opened} onAuxClick={(event) => { if (event.button === 1) opened(); }}>Open original ↗</a><button type="button" disabled={saving} aria-pressed={saved} onClick={save}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save video ◇'}</button></div>
        {ownPostId && <button type="button" className="mixed-video-remove" disabled={deleting} onClick={remove}>{deleting ? 'Removing…' : 'Remove your share'}</button>}
        {onFeedback && <div className="mixed-video-feedback" aria-label={`Tune recommendations for ${video.title}`}><button type="button" disabled={feedbackBusy} onClick={() => feedback('more')}>＋ More like this</button><button type="button" disabled={feedbackBusy} onClick={() => feedback('less')}>− Less like this</button><button type="button" disabled={feedbackBusy} onClick={() => feedback('hide')}>Hide</button></div>}
      </div>
    </article>
  </DraggableCard></div>;
}
