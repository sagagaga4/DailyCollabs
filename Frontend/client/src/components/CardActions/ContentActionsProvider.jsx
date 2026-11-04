import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { contentRequest } from './contentApi';
import { ACTION_LABELS, closestAction, createActionTargets, resolveDropAction } from './dragMath';
import { toActionContent } from './recommendations';
import { buildShareTargets } from './shareTargets';
import { CardActionsContext } from './useCardActions';
import './CardActions.css';


function ActionDialog({ modal, setModal, onClose, communities, joining, joinCommunity, notify }) {
  const dialogRef = useRef(null);
  const [communityId, setCommunityId] = useState('');
  const [channel, setChannel] = useState('general');
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const community = communities.find((item) => item._id === communityId);
  const content = modal.content;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    if (!communityId) { setChannels([]); return; }
    let active = true;
    setChannelsLoading(true); setError('');
    contentRequest(`/communities/${communityId}`).then((data) => {
      if (!active) return;
      const available = (data.channels || [{ id: 'general', name: 'general' }]).filter((item) => item.id !== 'welcome' && (!item.readOnly || data.isOwner));
      setChannels(available);
      setChannel(available.find((item) => item.id === 'general')?.id || available[0]?.id || '');
    }).catch((failure) => { if (active) { setChannels([]); setError(failure.message); } })
      .finally(() => { if (active) setChannelsLoading(false); });
    return () => { active = false; };
  }, [communityId]);

  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await contentRequest(`/content/${modal.mode === 'community' ? 'community' : 'repost'}`, { method: 'POST', body: JSON.stringify({ content, note, ...(modal.mode === 'community' ? { communityId, channelId: channel } : {}) }) });
      notify(modal.mode === 'community' ? { message: `Shared with ${community?.name || 'your community'}.`, to: `/Communities/${communityId}?channel=${encodeURIComponent(channel)}`, label: 'View in community' } : { message: data.created ? 'Reposted to your channel.' : 'This is already in your channel.', to: '/Channel', label: 'View my channel' });
      window.dispatchEvent(new CustomEvent('dailycollabs:content', { detail: { action: modal.mode, communityId, channelId: channel } }));
      onClose();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    setError('');
    try { await navigator.clipboard.writeText(content.url); setMessage('Link copied. Paste it wherever the conversation is happening.'); }
    catch { setError('Select and copy the link below. Clipboard access is unavailable.'); }
  }

  async function nativeShare() {
    setError('');
    try { await navigator.share({ title: content.title, text: content.description, url: content.url }); setMessage('Complete sharing in the app you choose.'); }
    catch (failure) { if (failure.name !== 'AbortError') setError('The share sheet could not open. You can copy the link instead.'); }
  }

  const shareTargets = buildShareTargets(content);
  const headings = { actions: 'Where should this go?', community: 'Share with a community', repost: 'Keep it on your channel', share: 'Good stories travel' };
  return <dialog ref={dialogRef} className="dc-action-dialog" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }} aria-labelledby="dc-action-heading">
    <div className="dc-action-dialog-inner">
      <button className="dc-dialog-close" onClick={onClose} disabled={busy} aria-label="Close card actions">×</button>
      <span className="dc-action-eyebrow">{content.type === 'video' ? 'VIDEO' : 'STORY'} ACTIONS</span><h2 id="dc-action-heading">{headings[modal.mode]}</h2>
      <div className="dc-source-preview">{content.image && <img src={content.image} alt="" />}<div><strong>{content.title}</strong><span>{new URL(content.url).hostname.replace(/^www\./, '')}</span></div></div>
      {modal.mode === 'actions' && <><p className="dc-action-help">Choose an action, or hold an open area of a card and drag it into a bubble.</p><div className="dc-action-menu">{[['community', '◎', 'Community', 'Bring it into a shared conversation.'], ['repost', '↻', 'Repost to my channel', 'Save it to your personal collection.'], ['share', '↗', 'Share', 'Send a link through an app you choose.']].map(([mode, icon, label, detail]) => <button key={mode} onClick={() => { setError(''); setModal({ ...modal, mode }); }}><span aria-hidden="true">{icon}</span><div><strong>{label}</strong><small>{detail}</small></div><span aria-hidden="true">→</span></button>)}</div></>}
      {['community', 'repost'].includes(modal.mode) && <form onSubmit={save} className="dc-action-form">
        {modal.mode === 'community' && <>
          <label htmlFor="dc-target-community">Community</label><select id="dc-target-community" required value={communityId} onChange={(event) => setCommunityId(event.target.value)}><option value="">Choose a community</option>{communities.map((item) => <option key={item._id} value={item._id}>{item.name}{item.isMember ? '' : ' · join first'}</option>)}</select>
          {!communities.length && <p className="dc-action-help">No communities loaded. <Link to="/Communities" onClick={onClose}>Explore communities</Link></p>}
          {community && !community.isMember && <div className="dc-action-join"><p>Join {community.name} to share with its members.</p>{community.requiresRulesAcceptance ? <Link to={`/Communities/${community._id}?channel=welcome`} onClick={onClose}>Read rules and join →</Link> : <button type="button" disabled={joining === community._id} onClick={async () => { const result = await joinCommunity(community._id); if (!result) setError('Could not join. Open the community to check its joining requirements.'); }}>{joining === community._id ? 'Joining…' : 'Join community'}</button>}</div>}
          {community?.isMember && <><label htmlFor="dc-target-channel">Channel</label><select id="dc-target-channel" required value={channel} disabled={channelsLoading || !channels.length} onChange={(event) => setChannel(event.target.value)}>{channelsLoading ? <option value="">Loading channels…</option> : channels.length ? channels.map((item) => <option value={item.id} key={item.id}>#{item.name}</option>) : <option value="">No writable channels</option>}</select></>}
        </>}
        <label htmlFor="dc-content-note">Add your take <span>(optional)</span></label><textarea id="dc-content-note" maxLength={1200} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={modal.mode === 'repost' ? 'Why do you want to keep this?' : 'What should people know about it?'} />
        <div className="dc-action-form-footer"><span>{note.length}/1,200</span><button className="dc-action-primary" disabled={busy || (modal.mode === 'community' && (!community?.isMember || !channel || channelsLoading))}>{busy ? 'Saving…' : modal.mode === 'community' ? 'Share with community ↗' : 'Repost to my channel ↻'}</button></div>
      </form>}
      {modal.mode === 'share' && <div className="dc-share-choices">
        {typeof navigator.share === 'function' && <button onClick={nativeShare}>↗ Share through my device</button>}
        <a href={shareTargets.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp <span>Choose a person or group ↗</span></a>
        <a href={shareTargets.email}>Email <span>Open an email draft ↗</span></a>
        <button onClick={copyLink}>Copy link <span>Paste anywhere ↗</span></button>
        <div className="dc-instagram-share"><strong>Instagram</strong><p>Copy this link, then share it in a message or story yourself. Instagram does not offer a universal web share link.</p><button onClick={() => { window.open(shareTargets.instagram, '_blank', 'noopener,noreferrer'); copyLink(); }}>Copy link & open Instagram ↗</button></div>
        <label htmlFor="dc-share-url">Original link<input id="dc-share-url" readOnly value={content.url} onFocus={(event) => event.target.select()} /></label>
      </div>}
      {error && <p className="dc-action-error" role="alert">{error}</p>}{message && <p className="dc-action-message" role="status">{message}</p>}
    </div>
  </dialog>;
}

export default function ContentActionsProvider({ children }) {
  const { pathname } = useLocation();
  const [communities, setCommunities] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(true);
  const [joining, setJoining] = useState('');
  const [modal, setModal] = useState(null);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const [notice, setNotice] = useState(null);
  const notify = useCallback((value) => setNotice(typeof value === 'string' ? { message: value } : value), []);
  useEffect(() => {
    let active = true;
    contentRequest('/communities').then((data) => { if (active && Array.isArray(data)) setCommunities(data); })
      .catch(() => { if (active) setCommunities([]); }).finally(() => { if (active) setCommunitiesLoading(false); });
    return () => { active = false; };
  }, [pathname]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 8000); return () => clearTimeout(timer); }, [notice]);

  const joinCommunity = useCallback(async (id) => {
    const target = communities.find((item) => item._id === id);
    if (target?.requiresRulesAcceptance) { notify({ message: 'Read the community rules before joining.', to: `/Communities/${id}?channel=welcome`, label: 'Read rules' }); return null; }
    setJoining(id);
    try {
      const updated = await contentRequest(`/communities/${id}/join`, { method: 'POST', body: '{}' });
      setCommunities((previous) => previous.map((item) => item._id === id ? { ...item, ...updated } : item));
      notify(`You joined ${updated.name}.`);
      window.dispatchEvent(new CustomEvent('dailycollabs:communities', { detail: updated }));
      return updated;
    } catch (failure) { notify(failure.message); return null; }
    finally { setJoining(''); }
  }, [communities, notify]);

  const openActions = useCallback((value, mode = 'actions') => {
    const content = toActionContent(value);
    if (content) setModal({ content, mode });
    else notify('This post does not have a shareable link.');
  }, [notify]);
  const cancelDrag = useCallback(() => { dragRef.current = null; setDrag(null); window.dispatchEvent(new Event('dailycollabs:dragcancel')); }, []);
  const beginDrag = useCallback((value, point) => {
    const content = toActionContent(value);
    if (!content) return;
    const state = { content, point, origin: point, targets: createActionTargets(point, { width: window.innerWidth, height: window.innerHeight }), hover: null };
    dragRef.current = state; setDrag(state);
  }, []);
  const updateDrag = useCallback((point) => {
    if (!dragRef.current) return;
    const next = { ...dragRef.current, point, hover: closestAction(point, dragRef.current.targets) };
    dragRef.current = next; setDrag(next);
  }, []);
  const finishDrag = useCallback((point) => {
    const current = dragRef.current;
    const action = current ? resolveDropAction(current.origin, point, current.targets) : null;
    cancelDrag();
    if (action) openActions(current.content, action);
  }, [cancelDrag, openActions]);
  useEffect(() => {
    const escape = (event) => { if (event.key === 'Escape') cancelDrag(); };
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', cancelDrag);
    window.addEventListener('resize', cancelDrag);
    return () => { window.removeEventListener('keydown', escape); window.removeEventListener('blur', cancelDrag); window.removeEventListener('resize', cancelDrag); };
  }, [cancelDrag]);

  const contextValue = useMemo(() => ({ communities, communitiesLoading, joining, joinCommunity, openActions, beginDrag, updateDrag, finishDrag, cancelDrag, notify }), [communities, communitiesLoading, joining, joinCommunity, openActions, beginDrag, updateDrag, finishDrag, cancelDrag, notify]);
  return <CardActionsContext.Provider value={contextValue}>
    {children}
    {drag && createPortal(<div className="dc-card-drag-layer" aria-live="polite"><div className="dc-card-drag-scrim" /><span className="dc-drag-instruction">Drag into a bubble. Release to choose. Esc to cancel.</span>{drag.targets.map((target) => <div className={`dc-action-bubble ${drag.hover === target.id ? 'is-over' : ''}`} style={{ left: target.x, top: target.y }} key={target.id}><span aria-hidden="true">{{ community: '◎', repost: '↻', share: '↗' }[target.id]}</span><strong>{ACTION_LABELS[target.id]}</strong></div>)}<div className="dc-drag-content-token" style={{ left: drag.point.x, top: drag.point.y }}><span>{drag.content.type === 'video' ? '▶' : '▤'}</span>{drag.content.title}</div></div>, document.body)}
    {modal && createPortal(<ActionDialog key={modal.content.url} modal={modal} setModal={setModal} communities={communities} joining={joining} joinCommunity={joinCommunity} notify={notify} onClose={() => setModal(null)} />, document.body)}
    {notice && createPortal(<div className="dc-action-toast" role="status"><span>{notice.message}</span>{notice.to && <Link to={notice.to} onClick={() => setNotice(null)}>{notice.label || 'View'} →</Link>}<button aria-label="Dismiss notification" onClick={() => setNotice(null)}>×</button></div>, document.body)}
  </CardActionsContext.Provider>;
}
