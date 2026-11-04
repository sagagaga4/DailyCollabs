import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import CommunityDialog from './CommunityDialog';
import { communityRequest } from './communityApi';
import EmojiPicker, { BrandEmoji, EmojiText } from '../BrandEmojis/BrandEmojis';
import './Communities.css';

function mergeMessages(previous, incoming) {
  const messages = new Map(previous.map(message => [message._id, message]));
  incoming.forEach(message => messages.set(message._id, message));
  return [...messages.values()].sort((a, b) => a._id.localeCompare(b._id));
}

export default function CommunityPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const channelId = searchParams.get('channel') || 'general';
  const inviteToken = searchParams.get('invite');
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [invite, setInvite] = useState('');
  const [draft, setDraft] = useState('');
  const [picker, setPicker] = useState(false);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [manage, setManage] = useState(null);
  const [syncError, setSyncError] = useState('');
  const errorRef = useRef(null);
  const activeChannel = useRef(`${id}:${channelId}`);
  const activeBoard = useRef(id);
  const communityRevision = useRef(0);
  const messageRevision = useRef(0);
  const reactionRequests = useRef(new Set());
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const shouldScroll = useRef(true);
  const sendingRef = useRef(null);
  activeChannel.current = `${id}:${channelId}`;
  activeBoard.current = id;
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setDraft(''); setAcceptedRules(false); setBusy(''); setManage(null); setInvite('');
    const refresh = () => {
      const revision = communityRevision.current;
      return communityRequest(`/${id}`).then(data => { if (active && revision === communityRevision.current) setCommunity(data); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    };
    refresh();
    const interval = setInterval(refresh, 12000);
    return () => { active = false; clearInterval(interval); };
  }, [id]);

  useEffect(() => {
    if (!community?._id || channelId === 'welcome') return;
    const controller = new AbortController();
    let fetching = false;
    let initial = true;
    setMessages([]); setMessagesLoading(true); setSyncError(''); setDraft(''); setPicker(false); setReactionPicker(null); setHasMore(false); setCursor(null); setBusy('');
    shouldScroll.current = true;
    async function sync() {
      if (fetching) return;
      fetching = true;
      const revision = messageRevision.current;
      try {
        const data = await communityRequest(`/${id}/channels/${encodeURIComponent(channelId)}/messages`, { signal: controller.signal });
        if (controller.signal.aborted || revision !== messageRevision.current) return;
        const element = listRef.current;
        shouldScroll.current = initial || !element || element.scrollHeight - element.scrollTop - element.clientHeight < 100;
        setMessages(previous => mergeMessages(previous, data.messages));
        if (initial) { setHasMore(data.hasMore); setCursor(data.nextCursor); }
        setSyncError('');
        initial = false;
      } catch (failure) { if (failure.name !== 'AbortError') setSyncError(failure.message); }
      finally { fetching = false; if (!controller.signal.aborted) setMessagesLoading(false); }
    }
    sync();
    const interval = setInterval(sync, 4000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [id, channelId, community?._id]);

  useEffect(() => {
    if (shouldScroll.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!community?.isMember) { setMembers([]); return; }
    let active = true;
    communityRequest(`/${id}/members`).then(data => { if (active) setMembers(data.members); }).catch(() => {});
    return () => { active = false; };
  }, [id, community?.isMember, community?.memberCount]);

  function selectChannel(next) {
    setSearchParams(previous => { const params = new URLSearchParams(previous); params.set('channel', next); return params; });
    setError(''); setNotice('');
  }
  async function membership(joining) {
    setBusy('membership'); setError(''); setNotice('');
    try {
      const updated = await communityRequest(`/${id}/${joining ? 'join' : 'membership'}`, { method: joining ? 'POST' : 'DELETE', ...(joining ? { body: JSON.stringify({ inviteToken: inviteToken || undefined, acceptedRules: acceptedRules === community.rulesVersion, rulesVersion: community.rulesVersion }) } : {}) });
      if (activeBoard.current !== id) return;
      communityRevision.current += 1;
      setCommunity(updated); setNotice(joining ? (community.isMember ? 'You accepted the current community rules. You can take part again.' : `You joined ${updated.name}. Say hello in #general.`) : `You left ${updated.name}. You can rejoin any time.`);
      if (joining && inviteToken) setSearchParams(previous => { const params = new URLSearchParams(previous); params.delete('invite'); return params; }, { replace: true });
    } catch (err) { if (activeBoard.current === id) setError(err.message); }
    finally { if (activeBoard.current === id) setBusy(''); }
  }
  async function getInvite() {
    setBusy('invite'); setError('');
    try {
      const data = await communityRequest(`/${id}/invite`, { method: 'POST', body: '{}' });
      if (activeBoard.current !== id) return;
      setInvite(`${window.location.origin}/Communities/${id}?invite=${encodeURIComponent(data.token)}`);
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(invite); setNotice('Invitation copied. Share it with your people.'); }
    catch { setNotice('Select the link and copy it to share.'); }
  }
  async function sendMessage(event) {
    event.preventDefault();
    const target = `${id}:${channelId}`;
    if (sendingRef.current === target || !draft.trim()) return;
    sendingRef.current = target;
    const content = draft.trim();
    setBusy('message'); setError('');
    try {
      const message = await communityRequest(`/${id}/channels/${encodeURIComponent(channelId)}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
      if (activeChannel.current !== target) return;
      messageRevision.current += 1;
      shouldScroll.current = true;
      setMessages(previous => mergeMessages(previous, [message])); setDraft(''); setPicker(false);
    } catch (err) { if (activeChannel.current === target) setError(err.message); }
    finally { if (sendingRef.current === target) sendingRef.current = null; if (activeChannel.current === target) { setBusy(''); textareaRef.current?.focus(); } }
  }
  async function react(message, emoji) {
    const requestId = `${message._id}:${emoji}`;
    if (reactionRequests.current.has(requestId)) return;
    reactionRequests.current.add(requestId);
    setReactionPicker(null);
    const target = `${id}:${channelId}`;
    try {
      const updated = await communityRequest(`/${id}/messages/${message._id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) });
      if (activeChannel.current === target) { messageRevision.current += 1; setMessages(previous => previous.map(item => item._id === updated._id ? updated : item)); }
    } catch (err) { if (activeChannel.current === target) setError(err.message); }
    finally { reactionRequests.current.delete(requestId); }
  }
  function insertEmoji(emoji) {
    const token = `:${emoji}:`;
    const input = textareaRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? start;
    const next = `${draft.slice(0, start)}${token} ${draft.slice(end)}`;
    if (next.length <= 3000) setDraft(next);
    setPicker(false);
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + token.length + 1, start + token.length + 1); });
  }
  async function olderMessages() {
    const target = `${id}:${channelId}`;
    setBusy('older');
    try {
      const data = await communityRequest(`/${id}/channels/${encodeURIComponent(channelId)}/messages?before=${encodeURIComponent(cursor)}`);
      if (activeChannel.current !== target) return;
      shouldScroll.current = false;
      setMessages(previous => mergeMessages(previous, data.messages)); setHasMore(data.hasMore); setCursor(data.nextCursor);
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }
  async function saveManagement(event) {
    event.preventDefault(); setBusy('manage'); setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (manage.mode === 'rules') {
        const data = await communityRequest(`/${id}/rules`, { method: 'PATCH', body: JSON.stringify({ rules: form.rules.split('\n').map(rule => rule.trim()).filter(Boolean), requireRulesAcceptance: form.requireRulesAcceptance === 'on' }) });
        if (activeBoard.current !== id) return;
        communityRevision.current += 1;
        setCommunity(previous => ({ ...previous, ...data })); setAcceptedRules(false);
      } else {
        const data = await communityRequest(`/${id}/channels${manage.channel ? `/${manage.channel.id}` : ''}`, { method: manage.channel ? 'PATCH' : 'POST', body: JSON.stringify({ name: form.name, topic: form.topic, readOnly: form.readOnly === 'on' }) });
        if (activeBoard.current !== id) return;
        communityRevision.current += 1;
        setCommunity(previous => ({ ...previous, channels: data.channels }));
        if (!manage.channel) selectChannel(form.name.toLowerCase());
      }
      setManage(null); setNotice('Your community settings are saved.');
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }

  if (loading) return <section className="communities-page" aria-busy="true"><Link className="community-back" to="/Communities">← All communities</Link><div className="community-detail-skeleton">Opening your space…</div></section>;
  if (!community) return <section className="communities-page"><Link className="community-back" to="/Communities">← All communities</Link><div className="community-empty"><h1>Community unavailable.</h1><p role="alert">{error}</p><Link className="community-button primary" to="/Communities">Explore communities</Link></div></section>;
  const channel = community.channels?.find(item => item.id === channelId);
  const canPost = community.isMember && !community.needsRulesAcceptance && channel?.type !== 'welcome' && (!channel?.readOnly || community.isOwner);
  const hasAcceptedRules = acceptedRules === community.rulesVersion;

  return <section className="communities-page community-chat-page" style={{ '--board-accent': community.accent }}>
    <header className="community-space-header"><Link to="/Communities" className="community-space-back" aria-label="All communities">←</Link><span className="community-board-icon">{community.icon}</span><div><span className="community-space-kicker">/{community.board}/ · {community.category}</span><h1 dir="auto">{community.name}</h1></div><div className="community-space-header-actions"><span>{community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}</span>{community.isMember ? <button type="button" className="community-button secondary" disabled={Boolean(busy)} onClick={getInvite}>Invite people ↗</button> : <button type="button" className="community-button primary" disabled={Boolean(busy)} onClick={() => community.requiresRulesAcceptance && !hasAcceptedRules ? selectChannel('welcome') : membership(true)}>{busy === 'membership' ? 'Joining…' : community.requiresRulesAcceptance && !hasAcceptedRules ? 'Read rules & join' : inviteToken ? 'Accept invitation' : 'Join community'}</button>}</div></header>
    {error && !manage && <p ref={errorRef} tabIndex={-1} className="community-message error" role="alert">{error}</p>}{notice && <p className="community-message success" role="status">{notice}</p>}
    <div className="community-space-layout">
      <aside className="community-channel-sidebar"><p className="community-small-label">YOUR PEOPLE. YOUR SIGNAL.</p><p className="community-space-description" dir="auto">{community.description}</p><div className="community-channel-label"><span>CHANNELS</span>{community.isOwner && <button type="button" aria-label="Create a channel" title="Create a channel" onClick={() => { setManage({ mode: 'channel' }); setError(''); }}>＋</button>}</div><nav aria-label="Community channels">{community.channels?.map(item => <button type="button" key={item.id} className={`community-channel-link ${item.id === channelId ? 'selected' : ''}`} aria-current={item.id === channelId ? 'page' : undefined} onClick={() => selectChannel(item.id)}><span aria-hidden="true">{item.type === 'welcome' ? '≡' : '#'}</span>{item.name}{item.readOnly && item.type !== 'welcome' && <small aria-label="Read-only">▣</small>}</button>)}</nav><div className="community-channel-identity"><BrandEmoji name="orbit" /><div><strong>Built around a shared curiosity.</strong><span>{community.isDemo ? 'Demo prompts. Real conversations.' : 'A space made by its members.'}</span></div></div>{community.isMember && !community.isOwner && <button type="button" className="community-leave" disabled={Boolean(busy)} onClick={() => membership(false)}>Leave community</button>}</aside>
      <main className="community-chat-main"><header className="community-chat-channel-header"><span className="community-channel-hash" aria-hidden="true">{channelId === 'welcome' ? '≡' : '#'}</span><div><h2>{channel?.name || 'Channel unavailable'}</h2><p>{channel?.topic || 'Choose a channel to start a conversation.'}</p></div>{community.isOwner && channel && channelId !== 'welcome' && <button type="button" className="community-channel-edit" aria-label="Edit channel" onClick={() => { setManage({ mode: 'channel', channel }); setError(''); }}>⚙</button>}</header>
        {channelId === 'welcome' ? <div className="community-welcome"><div className="community-welcome-mark"><BrandEmoji name="spark" /></div><p className="community-eyebrow">WELCOME TO YOUR NEXT GOOD CONVERSATION</p><h2>Good people.<br />A few ground rules.</h2><p dir="auto">{community.description}</p><ol>{community.rules.map((rule, index) => <li key={`${index}-${rule}`}><span>{String(index + 1).padStart(2, '0')}</span><p dir="auto">{rule}</p></li>)}</ol>{community.isOwner && <button type="button" className="community-button secondary" onClick={() => { setManage({ mode: 'rules' }); setError(''); }}>Edit community rules</button>}{(!community.isMember || community.needsRulesAcceptance) && community.requiresRulesAcceptance && <label className="community-rules-accept"><input type="checkbox" checked={hasAcceptedRules} onChange={event => setAcceptedRules(event.target.checked ? community.rulesVersion : false)} /> I’ve read and agree to these community rules.</label>}<button type="button" className="community-button primary" onClick={() => community.isMember && !community.needsRulesAcceptance ? selectChannel('general') : membership(true)} disabled={(!community.isMember || community.needsRulesAcceptance) && community.requiresRulesAcceptance && !hasAcceptedRules || busy === 'membership'}>{community.needsRulesAcceptance ? 'Accept updated rules →' : community.isMember ? 'Go to #general →' : 'Join and say hello →'}</button><div className="community-custom-emoji-intro"><span>OUR KIND OF EXPRESSION</span><EmojiPicker onChoose={name => { if (community.isMember) { selectChannel('general'); setNotice(`Use :${name}: in a message or react below any new message.`); } else setNotice('Join this community to use custom emoji reactions.'); }} /><p>31 original DailyCollabs glyphs. A little more character, a little less noise.</p></div></div> : !channel ? <div className="community-empty"><h2>This channel could not be found.</h2><button className="community-button secondary" type="button" onClick={() => selectChannel('general')}>Back to #general</button></div> : <>
          <div className="community-chat-sync"><span className={syncError ? 'has-error' : ''}>{syncError || 'Messages sync every 4 seconds'}</span>{channel.readOnly && <span>Read-only channel</span>}</div>
          <div className="community-message-list" ref={listRef} role="log" aria-label={`${channel.name} messages`} aria-live="polite" aria-busy={messagesLoading}>
            {hasMore && <button type="button" className="community-older" disabled={busy === 'older'} onClick={olderMessages}>{busy === 'older' ? 'Loading…' : 'Load earlier messages ↑'}</button>}
            {messagesLoading ? <p className="community-chat-loading">Loading conversations…</p> : messages.map(message => <article key={message._id} className="community-chat-message"><span className="community-message-avatar">{message.author.avatar ? <img src={message.author.avatar} alt="" loading="lazy" /> : message.author.username.slice(0, 1).toUpperCase()}</span><div className="community-message-body"><div className="community-message-meta"><strong dir="auto">{message.author.username}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>{message.isDemo && <span className="community-demo-label">Sample prompt</span>}{message.legacy && !message.isDemo && <span className="community-demo-label">From the original board</span>}</div><p className="community-message-text" dir="auto"><EmojiText text={message.content} /></p>{message.attachment && <a className="community-shared-card" href={message.attachment.url} target="_blank" rel="noopener noreferrer">{message.attachment.image && <img src={message.attachment.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}<div><span>{message.attachment.type === 'video' ? '↗ SHARED VIDEO' : '↗ SHARED ARTICLE'}</span><h3 dir="auto">{message.attachment.title}</h3>{message.attachment.description && <p dir="auto">{message.attachment.description}</p>}</div></a>}{!message.legacy && <div className="community-message-reactions">{message.reactions.map(reaction => <button type="button" key={reaction.emoji} aria-pressed={reaction.reacted} disabled={!community.isMember || community.needsRulesAcceptance} onClick={() => react(message, reaction.emoji)}><BrandEmoji name={reaction.emoji} /><span>{reaction.count}</span></button>)}{community.isMember && !community.needsRulesAcceptance && <button type="button" className="community-add-reaction" aria-label={`React to ${message.author.username}'s message`} onClick={() => setReactionPicker(reactionPicker === message._id ? null : message._id)}>＋ <BrandEmoji name="spark" /></button>}{reactionPicker === message._id && <EmojiPicker onChoose={emoji => react(message, emoji)} />}</div>}</div></article>)}
            {!messagesLoading && !messages.length && <div className="community-channel-empty"><BrandEmoji name="bloom" /><h3>This is the start of #{channel.name}.</h3><p>{community.isMember ? 'The first word could be yours. Share a question, a link, a little spark.' : 'Read along, then join when you’re ready to add your voice.'}</p></div>}
          </div>
          {canPost ? <form className="community-chat-composer" onSubmit={sendMessage} aria-busy={busy === 'message'}>{picker && <EmojiPicker onChoose={insertEmoji} />}<label className="community-sr-only" htmlFor="community-message-input">Message #{channel.name}</label><textarea id="community-message-input" dir="auto" ref={textareaRef} value={draft} onChange={event => setDraft(event.target.value)} maxLength={3000} rows={2} placeholder={`Message #${channel.name}`} disabled={busy === 'message'} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} /><div><button type="button" className="community-composer-emoji" aria-label="Insert a custom emoji" aria-expanded={picker} onClick={() => setPicker(!picker)} disabled={busy === 'message'}><BrandEmoji name="spark" /> Expressions</button><span>Shift + Enter for a new line</span><button type="submit" className="community-button primary" disabled={!draft.trim() || busy === 'message'}>{busy === 'message' ? 'Sending…' : 'Send ↗'}</button></div></form> : <div className="community-chat-join-prompt">{community.needsRulesAcceptance ? <><span>The community rules were updated. Read and accept them to take part.</span><button type="button" onClick={() => selectChannel('welcome')}>Review updated rules →</button></> : !community.isMember ? <><span>Join {community.name} to chat and react.</span><button type="button" onClick={() => community.requiresRulesAcceptance ? selectChannel('welcome') : membership(true)}>{community.requiresRulesAcceptance ? 'Read rules & join →' : 'Join community →'}</button></> : <span>This channel is read-only. The owner can post updates here.</span>}</div>}
        </>}
      </main>
      <aside className="community-member-sidebar"><div className="community-channel-label"><span>MEMBERS</span><span>{community.memberCount}</span></div>{community.isMember ? members.map(member => <div className="community-member" key={member._id}><span className="community-member-avatar">{member.avatar ? <img src={member.avatar} alt="" loading="lazy" /> : member.username.slice(0, 1).toUpperCase()}</span><div><strong dir="auto">{member.username}</strong><span>{member.role === 'owner' ? 'Owner' : 'Member'}</span></div>{member.role === 'owner' && <span className="community-owner-marker" title="Community owner">◇</span>}</div>) : <p className="community-member-note">Meet the members after you join.</p>}<div className="community-member-footnote"><BrandEmoji name="pulse" /><p>Good conversations start with a little curiosity.</p></div></aside>
    </div>
    {invite && <CommunityDialog title="Bring your people." description={`Anyone with this link can view ${community.name} and join after signing in.`} onClose={() => setInvite('')}><label className="community-invite-label">Invitation link<input readOnly value={invite} onFocus={event => event.target.select()} /></label><div className="community-dialog-actions"><button className="community-button secondary" onClick={() => setInvite('')}>Done</button><button className="community-button primary" onClick={copyInvite}>Copy invitation link</button></div><p className="community-invite-notice" role="status">{notice}</p></CommunityDialog>}
    {manage && <CommunityDialog title={manage.mode === 'rules' ? 'Set the tone.' : manage.channel ? 'Edit channel.' : 'A new conversation.'} description={manage.mode === 'rules' ? 'One rule per line. Keep them clear, fair, and useful.' : 'Channels help your community make room for different interests.'} onClose={() => setManage(null)} dismissible={busy !== 'manage'}><form className="community-form" onSubmit={saveManagement}><fieldset disabled={busy === 'manage'}>{manage.mode === 'rules' ? <><label>Community rules<textarea name="rules" dir="auto" defaultValue={community.rules.join('\n')} rows={6} required /></label><label className="community-checkbox"><input type="checkbox" name="requireRulesAcceptance" defaultChecked={community.requiresRulesAcceptance} />Ask new members to acknowledge the rules before joining</label></> : <><label>Channel name<input name="name" defaultValue={manage.channel?.name || ''} minLength={2} maxLength={32} pattern="[a-z0-9][a-z0-9-]*" required placeholder="e.g. discoveries" /></label><label>Topic<input name="topic" dir="auto" defaultValue={manage.channel?.topic || ''} maxLength={160} placeholder="What is this channel for?" /></label><label className="community-checkbox"><input type="checkbox" name="readOnly" defaultChecked={manage.channel?.readOnly || false} />Only the owner can post in this channel</label></>}</fieldset>{error && <p className="community-message error" role="alert">{error}</p>}<div className="community-dialog-actions"><button type="button" className="community-button secondary" disabled={busy === 'manage'} onClick={() => setManage(null)}>Cancel</button><button type="submit" className="community-button primary" disabled={busy === 'manage'}>{busy === 'manage' ? 'Saving…' : 'Save changes'}</button></div></form></CommunityDialog>}
  </section>;
}
