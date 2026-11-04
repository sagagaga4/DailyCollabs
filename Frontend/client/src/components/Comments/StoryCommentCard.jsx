import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmojiText } from '../BrandEmojis/BrandEmojis';
import { contentRequest } from '../CardActions/contentApi';
import { useStoryComments } from './useStoryComments';

export default function StoryCommentCard({ comment, onReply, onUpdated, showStory = false, highlighted = false }) {
  const context = useStoryComments();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const content = { url: comment.url, title: comment.title, type: comment.type };
  async function mutate(action, options) {
    setBusy(action); setError(''); setNotice('');
    try {
      const data = await contentRequest(`/story-comments/${comment._id}${action === 'reaction' ? '/reaction' : action === 'repost' ? '/repost' : ''}`, options);
      if (action === 'delete') { onUpdated?.({ ...comment, deleted: true, text: '', isOwner: false }); setNotice('Comment removed.'); }
      else { onUpdated?.(data.comment || data); if (action === 'edit') { setEditing(false); setNotice('Comment updated.'); } if (action === 'repost') setNotice(data.created ? 'Reposted to your channel.' : 'Already in your channel.'); }
      context?.commentChanged(comment.url);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(''); }
  }
  return <article className={`dc-story-comment ${comment.parentId ? 'is-reply' : ''} ${highlighted ? 'is-highlighted' : ''}`} data-comment-id={comment._id}>
    <header><span className="dc-comment-avatar">{comment.author?.avatar ? <img src={comment.author.avatar} alt="" /> : (comment.author?.username || '?').slice(0, 1).toUpperCase()}</span><div><strong dir="auto">{comment.author?.username || 'Former member'}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{comment.edited ? ' · edited' : ''}</time></div>{comment.isOwner && <span className="dc-comment-yours">YOU</span>}</header>
    {showStory && <button className="dc-comment-story-link" onClick={() => context?.openComments(content, { focusId: comment._id })} dir="auto">{comment.title} ↗</button>}
    {comment.parentId && <div className="dc-comment-parent" dir="auto"><span>↳ Reply to {comment.parentAuthorName ? `@${comment.parentAuthorName}` : 'a comment'}</span>{comment.parentPreview && <p><EmojiText text={comment.parentPreview} /></p>}</div>}
    {editing ? <form className="dc-comment-edit" onSubmit={(event) => { event.preventDefault(); mutate('edit', { method: 'PATCH', body: JSON.stringify({ text: draft }) }); }}><label className="dc-visually-hidden" htmlFor={`edit-${comment._id}`}>Edit your comment</label><textarea id={`edit-${comment._id}`} dir="auto" value={draft} maxLength={2000} required onChange={(event) => setDraft(event.target.value)} rows={3} /><div><button type="button" disabled={Boolean(busy)} onClick={() => setEditing(false)}>Cancel</button><button className="dc-comment-primary" disabled={Boolean(busy) || !draft.trim()}>{busy === 'edit' ? 'Saving…' : 'Save changes'}</button></div></form> : <div className={`dc-comment-text ${comment.deleted ? 'is-removed' : ''}`} dir="auto">{comment.deleted ? 'This comment was removed.' : <EmojiText text={comment.text} />}</div>}
    {!comment.deleted && !editing && <footer><div className="dc-comment-response-actions"><button aria-label="Like comment" aria-pressed={comment.myReaction === 'like'} disabled={Boolean(busy)} onClick={() => mutate('reaction', { method: 'POST', body: JSON.stringify({ type: 'like' }) })}>↑ <span>{comment.likes}</span></button><button aria-label="Dislike comment" aria-pressed={comment.myReaction === 'dislike'} disabled={Boolean(busy)} onClick={() => mutate('reaction', { method: 'POST', body: JSON.stringify({ type: 'dislike' }) })}>↓ <span>{comment.dislikes}</span></button><button disabled={Boolean(busy)} onClick={() => onReply ? onReply(comment) : context?.openComments(content, { focusId: comment._id, replyTo: comment })}>↳ Reply</button><button disabled={Boolean(busy)} onClick={() => mutate('repost', { method: 'POST', body: '{}' })}>{busy === 'repost' ? 'Reposting…' : `↻ Repost${comment.repostCount ? ` ${comment.repostCount}` : ''}`}</button></div>{comment.isOwner && <div className="dc-comment-owner-actions"><button disabled={Boolean(busy)} onClick={() => { setDraft(comment.text); setEditing(true); }}>Edit</button><button disabled={Boolean(busy)} onClick={() => { if (window.confirm('Remove your comment? Replies will stay in the conversation.')) mutate('delete', { method: 'DELETE' }); }}>Remove</button></div>}</footer>}
    {error && <p className="dc-comment-error" role="alert">{error}</p>}{notice && <p className="dc-comment-notice" role="status">{notice}{notice.includes('channel') && <> <Link to="/Channel">View channel →</Link></>}</p>}
  </article>;
}
