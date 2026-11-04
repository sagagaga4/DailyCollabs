import { useState } from 'react';
import { BrandEmoji, EmojiText } from '../BrandEmojis/BrandEmojis';
import { contentRequest } from '../CardActions/contentApi';
import { useStoryComments } from '../Comments/useStoryComments';
import './Notifications.css';
const VERBS = { like: 'liked your comment', dislike: 'disliked your comment', reply: 'replied to your comment', repost: 'reposted your comment' };
const SYMBOLS = { like: '↑', dislike: '↓', reply: '↳', repost: '↻' };
export default function Notifications() {
  const context = useStoryComments();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  if (!context) return <p>Loading notifications…</p>;
  const { notifications, unreadCount, notificationsLoading, notificationError, markNotificationRead, markAllNotificationsRead, loadMoreNotifications, notificationsHaveMore, refreshNotifications, openComments } = context;
  async function view(notification) {
    setBusy(notification._id); setError('');
    try { if (!notification.readAt) await markNotificationRead(notification._id); const comment = await contentRequest(`/story-comments/${notification.targetCommentId || notification.commentId}`); openComments({ url: comment.url, title: comment.title, type: comment.type }, { focusId: comment._id }); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(''); }
  }
  async function markAll() { setBusy('all'); setError(''); try { await markAllNotificationsRead(); } catch (failure) { setError(failure.message); } finally { setBusy(''); } }
  async function more() { setBusy('more'); setError(''); try { await loadMoreNotifications(); } catch (failure) { setError(failure.message); } finally { setBusy(''); } }
  return <section className="dc-notifications-page"><header><div><span className="dc-comment-eyebrow">CONVERSATIONS COME FULL CIRCLE</span><h1>Notifications<span>.</span></h1><p>{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'} from your conversations.` : 'You are all caught up.'}</p></div><button className="dc-notifications-read-all" disabled={!unreadCount || Boolean(busy)} onClick={markAll}>{busy === 'all' ? 'Updating…' : 'Mark all as read'}</button></header>{(error || notificationError) && <p className="dc-comment-error" role="alert">{error || notificationError} <button onClick={refreshNotifications}>Try again</button></p>}{notificationsLoading ? <p className="dc-comments-state" role="status">Checking your conversations…</p> : notifications.length ? <div className="dc-notifications-list">{notifications.map((notification) => <article key={notification._id} className={`dc-notification ${notification.readAt ? '' : 'is-unread'}`}><span className={`dc-notification-symbol is-${notification.type}`} aria-hidden="true">{SYMBOLS[notification.type]}</span><div className="dc-notification-content"><p dir="auto"><strong>{notification.actor?.username || 'Former member'}</strong> {VERBS[notification.type] || 'updated your conversation'}{!notification.readAt && <span className="dc-notification-unread-dot" aria-label="Unread" />}</p><span className="dc-notification-story" dir="auto">{notification.title}</span><blockquote dir="auto"><EmojiText text={notification.excerpt} /></blockquote><footer><time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><button disabled={Boolean(busy)} onClick={() => view(notification)}>{busy === notification._id ? 'Opening…' : 'View conversation →'}</button></footer></div></article>)}</div> : !notificationError && <div className="dc-comments-state"><BrandEmoji name="dc_satellite" /><h2>Your next connection is on its way.</h2><p>When someone likes, dislikes, replies to, or reposts your comment, you will find it here.</p></div>}{notificationsHaveMore && <button className="dc-comment-load-more" disabled={Boolean(busy)} onClick={more}>{busy === 'more' ? 'Loading…' : 'Older notifications'}</button>}</section>;
}
