import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import EmojiPicker, { BrandEmoji } from '../BrandEmojis/BrandEmojis';
import { contentRequest } from '../CardActions/contentApi';
import { toActionContent } from '../CardActions/recommendations';
import StoryCommentCard from './StoryCommentCard';
import { canonicalThreadUrl } from './commentThreads';
import { StoryCommentsContext } from './useStoryComments';
import './StoryComments.css';

function ThreadDialog({ selected, close, commentChanged, updateCount }) {
  const dialogRef = useRef(null);
  const textareaRef = useRef(null);
  const loadedOlder = useRef(false);
  const requestRevision = useRef(0);
  const posting = useRef(false);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [reply, setReply] = useState(selected.replyTo || null);
  const [busy, setBusy] = useState(false);
  const [emojisOpen, setEmojisOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const url = canonicalThreadUrl(selected.content.url);
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  useEffect(() => { if (reply) textareaRef.current?.focus(); }, [reply]);
  useEffect(() => {
    let active = true;
    async function load() {
      if (posting.current) return;
      const revision = requestRevision.current;
      try {
        const [data, focus] = await Promise.all([contentRequest(`/story-comments/thread?url=${encodeURIComponent(url)}`), selected.focusId ? contentRequest(`/story-comments/${encodeURIComponent(selected.focusId)}`).catch(() => null) : null]);
        if (!active || revision !== requestRevision.current) return;
        const list = data.comments || [];
        if (focus?.url === url && !list.some((row) => row._id === focus._id)) list.unshift(focus);
        setComments((previous) => loadedOlder.current ? [...list, ...previous.filter((row) => !list.some((latest) => latest._id === row._id))] : list); setCount(data.totalCount); updateCount(url, data.totalCount); if (!loadedOlder.current) { setHasMore(Boolean(data.hasMore)); setCursor(data.nextCursor); } setError('');
      } catch (failure) { if (active && revision === requestRevision.current) setError(failure.message); }
      finally { if (active && revision === requestRevision.current) setLoading(false); }
    }
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [selected.focusId, url, updateCount]);
  useEffect(() => {
    if (loading || !selected.focusId) return;
    const frame = requestAnimationFrame(() => {
      const target = [...(dialogRef.current?.querySelectorAll('[data-comment-id]') || [])].find((element) => element.dataset.commentId === selected.focusId);
      target?.scrollIntoView({ block: 'center', behavior: document.documentElement.dataset.reducedMotion === 'true' ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, selected.focusId]);
  async function submit(event) {
    event.preventDefault(); ++requestRevision.current; posting.current = true; setBusy(true); setError('');
    try {
      const comment = await contentRequest('/story-comments', { method: 'POST', body: JSON.stringify({ url, title: selected.content.title, type: selected.content.type, text, parentId: reply?._id }) });
      setComments((previous) => [comment, ...previous]); setText(''); setReply(null); setEmojisOpen(false); setCount((value) => value + 1); commentChanged(url);
    } catch (failure) { setError(failure.message); }
    finally { posting.current = false; setLoading(false); setBusy(false); }
  }
  async function more() {
    setLoadingMore(true);
    try { const data = await contentRequest(`/story-comments/thread?url=${encodeURIComponent(url)}&before=${encodeURIComponent(cursor)}`); loadedOlder.current = true; setComments((previous) => [...previous, ...data.comments.filter((row) => !previous.some((existing) => existing._id === row._id))]); setHasMore(data.hasMore); setCursor(data.nextCursor); }
    catch (failure) { setError(failure.message); }
    finally { setLoadingMore(false); }
  }
  return <dialog ref={dialogRef} className="dc-thread-dialog" aria-labelledby="dc-thread-title" onCancel={(event) => { event.preventDefault(); if (!busy) close(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) close(); }}><div className="dc-thread-inner"><header className="dc-thread-header"><div><span className="dc-comment-eyebrow">THE CONVERSATION</span><h2 id="dc-thread-title">A little perspective.</h2></div><button disabled={busy} aria-label="Close comments" onClick={close}>×</button></header><div className="dc-thread-source"><strong dir="auto">{selected.content.title}</strong><a href={selected.content.url} target="_blank" rel="noopener noreferrer">Open original {selected.content.type === 'video' ? 'video' : 'story'} ↗</a></div>
    <form className="dc-comment-composer" onSubmit={submit}>{reply && <div className="dc-composer-reply"><span dir="auto">↳ Replying to @{reply.author?.username || 'member'}</span><button type="button" aria-label="Cancel reply" onClick={() => setReply(null)}>×</button></div>}<label htmlFor="dc-comment-text">{reply ? 'Your reply' : 'Add your perspective'}</label><textarea ref={textareaRef} id="dc-comment-text" dir="auto" required maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="What do you think? Keep it thoughtful." /><div className="dc-comment-composer-footer"><button type="button" className="dc-comment-emoji-toggle" aria-expanded={emojisOpen} onClick={() => setEmojisOpen((value) => !value)}><BrandEmoji name="dc_grin" /> Expressions</button><span>{text.length}/2,000</span><button className="dc-comment-primary" disabled={busy || !text.trim()}>{busy ? 'Posting…' : reply ? 'Post reply ↗' : 'Post comment ↗'}</button></div>{emojisOpen && <div className="dc-comment-emoji-picker"><EmojiPicker onChoose={(name) => setText((value) => `${value}${value && !value.endsWith(' ') ? ' ' : ''}:${name}: `.slice(0, 2000))} /></div>}</form>
    {error && <p className="dc-comment-error" role="alert">{error}</p>}<div className="dc-thread-list-heading"><h3>Comments <span>{count}</span></h3><Link to="/Comments" onClick={close}>My comments ↗</Link></div>{loading ? <p className="dc-comments-state" role="status">Opening the conversation…</p> : comments.length ? <div className="dc-thread-list">{comments.map((comment) => <StoryCommentCard key={comment._id} comment={comment} highlighted={comment._id === selected.focusId} onReply={setReply} onUpdated={(updated) => { ++requestRevision.current; setComments((previous) => previous.map((row) => row._id === updated._id ? updated : row)); if (updated.deleted && !comment.deleted) setCount((value) => Math.max(0, value - 1)); }} />)}</div> : <div className="dc-comments-state"><BrandEmoji name="spark" /><h3>The first word is yours.</h3><p>Share an idea, ask a question, or bring a fresh perspective.</p></div>}{hasMore && <button className="dc-comment-load-more" disabled={loadingMore} onClick={more}>{loadingMore ? 'Loading…' : 'Older comments'}</button>}</div></dialog>;
}

export default function StoryCommentsProvider({ children }) {
  const tracked = useRef(new Map());
  const [revision, setRevision] = useState(0);
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationError, setNotificationError] = useState('');
  const [notificationCursor, setNotificationCursor] = useState(null);
  const [notificationsHaveMore, setNotificationsHaveMore] = useState(false);
  const loadedOlderNotifications = useRef(false);
  const trackContent = useCallback((value) => {
    const url = canonicalThreadUrl(value?.url || value?.link);
    if (!url || tracked.current.has(url)) return;
    if (tracked.current.size >= 500) tracked.current.delete(tracked.current.keys().next().value);
    tracked.current.set(url, true); setRevision((number) => number + 1);
  }, []);
  const updateCount = useCallback((url, value) => setCounts((previous) => previous[url] === value ? previous : { ...previous, [url]: value }), []);
  const refreshCounts = useCallback(async () => {
    const urls = [...tracked.current.keys()];
    for (let index = 0; index < urls.length; index += 50) {
      try { const data = await contentRequest('/story-comments/counts', { method: 'POST', body: JSON.stringify({ urls: urls.slice(index, index + 50) }) }); setCounts((previous) => ({ ...previous, ...data.counts })); }
      catch { /* A temporarily unavailable count should not hide a card. */ }
    }
  }, []);
  useEffect(() => { const timer = setTimeout(refreshCounts, 160); return () => clearTimeout(timer); }, [revision, refreshCounts]);
  const refreshNotifications = useCallback(async () => {
    try {
      const data = await contentRequest('/notifications');
      setNotifications((previous) => [...data.notifications, ...previous.filter((item) => !data.notifications.some((latest) => latest._id === item._id))]);
      setUnreadCount(data.unreadCount); if (!loadedOlderNotifications.current) { setNotificationsHaveMore(data.hasMore); setNotificationCursor(data.nextCursor); } setNotificationError('');
    } catch (failure) { setNotificationError(failure.message); }
    finally { setNotificationsLoading(false); }
  }, []);
  useEffect(() => {
    refreshNotifications();
    const refreshVisible = () => { if (!document.hidden) { refreshNotifications(); refreshCounts(); } };
    const timer = setInterval(refreshVisible, 10000);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [refreshNotifications, refreshCounts]);
  const commentChanged = useCallback((url) => { refreshCounts(); refreshNotifications(); window.dispatchEvent(new CustomEvent('dailycollabs:comments', { detail: { url } })); }, [refreshCounts, refreshNotifications]);
  const openComments = useCallback((value, options = {}) => { const content = toActionContent(value); if (content) { trackContent(content); setSelected({ content, ...options }); } }, [trackContent]);
  const markNotificationRead = useCallback(async (id) => { const data = await contentRequest(`/notifications/${id}/read`, { method: 'PATCH', body: '{}' }); setNotifications((previous) => previous.map((row) => row._id === id ? { ...row, readAt: data.readAt } : row)); setUnreadCount(data.unreadCount); }, []);
  const markAllNotificationsRead = useCallback(async () => { const data = await contentRequest('/notifications/read-all', { method: 'PATCH', body: '{}' }); setNotifications((previous) => previous.map((row) => new Date(row.createdAt) <= new Date(data.readAt) ? { ...row, readAt: row.readAt || data.readAt } : row)); setUnreadCount(data.unreadCount); }, []);
  const loadMoreNotifications = useCallback(async () => { if (!notificationCursor) return; loadedOlderNotifications.current = true; const data = await contentRequest(`/notifications?before=${notificationCursor}`); setNotifications((previous) => [...previous, ...data.notifications.filter((row) => !previous.some((existing) => existing._id === row._id))]); setNotificationsHaveMore(data.hasMore); setNotificationCursor(data.nextCursor); setUnreadCount(data.unreadCount); }, [notificationCursor]);
  const value = useMemo(() => ({ openComments, trackContent, counts, commentChanged, notifications, unreadCount, notificationsLoading, notificationError, refreshNotifications, markNotificationRead, markAllNotificationsRead, loadMoreNotifications, notificationsHaveMore }), [openComments, trackContent, counts, commentChanged, notifications, unreadCount, notificationsLoading, notificationError, refreshNotifications, markNotificationRead, markAllNotificationsRead, loadMoreNotifications, notificationsHaveMore]);
  return <StoryCommentsContext.Provider value={value}>{children}{selected && createPortal(<ThreadDialog key={`${selected.content.url}:${selected.focusId || ''}`} selected={selected} close={() => setSelected(null)} commentChanged={commentChanged} updateCount={updateCount} />, document.body)}</StoryCommentsContext.Provider>;
}
