import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageActive } from '../Navigation/PageActivity';
import { contentRequest } from '../CardActions/contentApi';
import { BrandEmoji } from '../BrandEmojis/BrandEmojis';
import { useStoryComments } from './useStoryComments';
import StoryCommentCard from './StoryCommentCard';
import './StoryComments.css';

export default function MyComments() {
  const pageActive = usePageActive();
  const loadedRevision = useRef(null);
  const loadedOlder = useRef(false);
  const handledFocus = useRef(null);
  const [params] = useSearchParams();
  const focusId = params.get('comment');
  const context = useStoryComments();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const openComments = context?.openComments;
  useEffect(() => {
    if (!pageActive || loadedRevision.current === revision) return;
    let active = true;
    const controller = new AbortController();
    contentRequest('/story-comments/mine', { signal: controller.signal }).then((data) => {
      if (!active) return;
      setComments(previous => loadedOlder.current ? [...data.comments, ...previous.filter(row => !data.comments.some(latest => latest._id === row._id))] : data.comments);
      if (!loadedOlder.current) { setCursor(data.nextCursor); setHasMore(data.hasMore); }
      loadedRevision.current = revision; setError('');
    }).catch((failure) => { if (active && failure.name !== 'AbortError') setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [revision, pageActive]);
  useEffect(() => { const refresh = () => setRevision((value) => value + 1); window.addEventListener('dailycollabs:comments', refresh); return () => window.removeEventListener('dailycollabs:comments', refresh); }, []);
  useEffect(() => {
    if (!focusId) { handledFocus.current = null; return; }
    if (!pageActive || !openComments || handledFocus.current === focusId) return;
    let active = true;
    const controller = new AbortController();
    contentRequest(`/story-comments/${encodeURIComponent(focusId)}`, { signal: controller.signal }).then((comment) => {
      if (active) { handledFocus.current = focusId; openComments({ url: comment.url, title: comment.title, type: comment.type }, { focusId: comment._id }); }
    }).catch((failure) => { if (active && failure.name !== 'AbortError') setError(failure.message); });
    return () => { active = false; controller.abort(); };
  }, [focusId, openComments, pageActive]);
  async function more() {
    setBusy(true);
    try { const data = await contentRequest(`/story-comments/mine?before=${cursor}`); loadedOlder.current = true; setComments((previous) => [...previous, ...data.comments.filter((row) => !previous.some((item) => item._id === row._id))]); setHasMore(data.hasMore); setCursor(data.nextCursor); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="dc-my-comments"><header className="dc-comments-page-header"><div><span className="dc-comment-eyebrow">YOUR SIDE OF THE STORY</span><h1>My comments<span>.</span></h1><p>Every perspective you shared, saved to your account.</p></div><BrandEmoji name="dc_brain" /></header>{error && <p className="dc-comment-error" role="alert">{error} <button onClick={() => setRevision((value) => value + 1)}>Try again</button></p>}{loading ? <p className="dc-comments-state" role="status">Finding your conversations…</p> : comments.length ? <div className="dc-my-comments-list">{comments.map((comment) => <StoryCommentCard key={comment._id} comment={comment} showStory onUpdated={(updated) => setComments((previous) => previous.map((row) => row._id === updated._id ? updated : row))} />)}</div> : !error && <div className="dc-comments-state"><BrandEmoji name="spark" /><h2>Good conversations start with you.</h2><p>Open Comments on any story or video. Your comments and replies will live here.</p><Link className="dc-comment-load-more" to="/">Explore your feed ↗</Link></div>}{hasMore && <button className="dc-comment-load-more" disabled={busy} onClick={more}>{busy ? 'Loading…' : 'Older comments'}</button>}</section>;
}
