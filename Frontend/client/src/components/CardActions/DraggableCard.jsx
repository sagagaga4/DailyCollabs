import { useEffect, useRef, useState } from 'react';
import { LONG_PRESS_MS, movedBeyondPress } from './dragMath';
import { toActionContent } from './recommendations';
import { useCardActions } from './useCardActions';
import { useStoryComments } from '../Comments/useStoryComments';
import { canonicalThreadUrl } from '../Comments/commentThreads';

const INTERACTIVE = 'a, button, input, textarea, select, video, iframe, audio, summary, [contenteditable="true"], [role="button"], [data-card-no-drag]';

export default function DraggableCard({ content, children, className = '', style }) {
  const { beginDrag, updateDrag, finishDrag, cancelDrag, openActions } = useCardActions();
  const commentsContext = useStoryComments();
  const trackContent = commentsContext?.trackContent;
  const contentKey = canonicalThreadUrl(content?.url || content?.link);
  const commentCount = contentKey ? commentsContext?.counts[contentKey] : undefined;
  const cardRef = useRef(null);
  const pending = useRef(null);
  const active = useRef(false);
  const latestContent = useRef(content);
  const [dragging, setDragging] = useState(false);
  const suppressClickUntil = useRef(0);
  latestContent.current = content;
  useEffect(() => { if (contentKey) trackContent?.(latestContent.current); }, [contentKey, trackContent]);

  useEffect(() => {
    const card = cardRef.current;
    const preventActiveScroll = (event) => { if (active.current) event.preventDefault(); };
    const resetDrag = () => {
      if (pending.current) { clearTimeout(pending.current.timer); try { card?.releasePointerCapture(pending.current.pointerId); } catch { /* Already released. */ } }
      pending.current = null; active.current = false; setDragging(false);
    };
    card?.addEventListener('touchmove', preventActiveScroll, { passive: false });
    window.addEventListener('dailycollabs:dragcancel', resetDrag);
    return () => {
      card?.removeEventListener('touchmove', preventActiveScroll);
      window.removeEventListener('dailycollabs:dragcancel', resetDrag);
      if (pending.current) clearTimeout(pending.current.timer);
      if (active.current) cancelDrag();
    };
  }, [cancelDrag]);

  function cancelPending() {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  }

  function pointerDown(event) {
    if (event.button !== 0 || event.isPrimary === false || event.target.closest(INTERACTIVE) || !toActionContent(latestContent.current)) return;
    cancelPending();
    const point = { x: event.clientX, y: event.clientY };
    const pointerId = event.pointerId;
    pending.current = { point, pointerId, timer: setTimeout(() => {
      if (!pending.current || pending.current.pointerId !== pointerId) return;
      active.current = true;
      suppressClickUntil.current = Date.now() + 1000;
      setDragging(true);
      beginDrag(latestContent.current, point);
      try { cardRef.current?.setPointerCapture(pointerId); } catch { /* Pointer can end before the timer fires. */ }
    }, LONG_PRESS_MS) };
  }

  function pointerMove(event) {
    const point = { x: event.clientX, y: event.clientY };
    if (active.current) { event.preventDefault(); updateDrag(point); }
    else if (pending.current && movedBeyondPress(pending.current.point, point)) cancelPending();
  }

  function pointerUp(event) {
    cancelPending();
    if (!active.current) return;
    event.preventDefault();
    active.current = false; setDragging(false);
    suppressClickUntil.current = Date.now() + 250;
    finishDrag({ x: event.clientX, y: event.clientY });
    try { cardRef.current?.releasePointerCapture(event.pointerId); } catch { /* Already released by the browser. */ }
  }

  function pointerCancel() {
    cancelPending();
    if (active.current) { active.current = false; setDragging(false); cancelDrag(); }
  }

  return <div ref={cardRef} className={`dc-draggable-card ${dragging ? 'is-dragging' : ''} ${className}`} style={style} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onLostPointerCapture={pointerCancel} onClickCapture={(event) => { if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); } }} onPointerLeave={() => { if (!active.current) cancelPending(); }} onContextMenu={(event) => { if (active.current) event.preventDefault(); }}>
    {children}
    {contentKey && <div className="dc-card-conversation-footer" data-card-no-drag><button type="button" onClick={() => commentsContext?.openComments(content)}><svg className="dc-conversation-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z" /><path d="M7 9h9M7 13h6" /></svg> Comments{commentCount !== undefined && <span className="dc-comment-count">{commentCount}</span>}</button><button type="button" onClick={() => openActions(content, 'repost')}><span aria-hidden="true">↻</span> Repost</button></div>}
    <button type="button" className="dc-card-more" aria-label={`More actions for ${content?.title || 'this post'}`} aria-haspopup="dialog" title="More actions · hold the card to drag" onClick={(event) => { event.stopPropagation(); openActions(content); }}><span aria-hidden="true">···</span></button>
  </div>;
}
