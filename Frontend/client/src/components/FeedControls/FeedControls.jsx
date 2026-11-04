import { useEffect, useId, useRef, useState } from 'react';
import { feedRequest } from './feedApi';
import './FeedControls.css';

const MODES = [
  { id: 'balanced', label: 'Balanced', detail: 'A little of everything' },
  { id: 'fresh', label: 'Fresh', detail: 'Put recent stories first' },
  { id: 'discover', label: 'Discover', detail: 'Explore beyond the familiar' },
  { id: 'following', label: 'Following', detail: 'Lean into your interests' },
];

function TuneIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14M7 3v4m6 1v4m-7 1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg>;
}

function FeedDialog({ onClose, onChange }) {
  const ref = useRef(null);
  const titleId = useId();
  const introId = useId();
  const [envelope, setEnvelope] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [muteInput, setMuteInput] = useState('');
  const [followInput, setFollowInput] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const active = useRef(true);
  const pending = useRef(false);
  const busy = saving || resetting;

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    active.current = true;
    setLoading(true); setError('');
    feedRequest('/preferences', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setEnvelope(data); setDraft(data.preferences); }
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); active.current = false; };
  }, [retry]);

  const dirty = draft && envelope && JSON.stringify(draft) !== JSON.stringify(envelope.preferences);
  function change(name, value) { setDraft(previous => ({ ...previous, [name]: value })); setNotice(''); }
  function addFollowedTopic() {
    const topic = followInput.trim();
    if (!topic) return;
    if (topic.length > 80) { setError('Keep each followed topic under 80 characters.'); return; }
    if (draft.followedTopics.length >= 30) { setError('You can follow up to 30 topics. Remove one to make room.'); return; }
    if (draft.followedTopics.some(item => item.toLocaleLowerCase() === topic.toLocaleLowerCase())) { setFollowInput(''); return; }
    change('followedTopics', [...draft.followedTopics, topic]); setFollowInput(''); setError('');
  }
  function addMutedTopic() {
    const topic = muteInput.trim();
    if (!topic) return;
    if (topic.length > 80) { setError('Keep each muted topic under 80 characters.'); return; }
    if (draft.mutedTopics.length >= 20) { setError('You can mute up to 20 topics. Remove one to make room.'); return; }
    if (draft.mutedTopics.some(item => item.toLocaleLowerCase() === topic.toLocaleLowerCase())) { setMuteInput(''); return; }
    change('mutedTopics', [...draft.mutedTopics, topic]); setMuteInput(''); setError('');
  }
  async function save(event) {
    event.preventDefault();
    if (!dirty || pending.current) return;
    pending.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const data = await feedRequest('/preferences', { method: 'PATCH', body: JSON.stringify(draft) });
      if (!active.current) return;
      setEnvelope(data); setDraft(data.preferences); setNotice('Your feed preferences are saved.');
      onChange?.(data.preferences);
      window.dispatchEvent(new CustomEvent('dailycollabs:feed-preferences', { detail: data }));
    } catch (failure) { if (active.current) setError(failure.message); }
    finally { pending.current = false; if (active.current) setSaving(false); }
  }
  async function resetHistory() {
    if (pending.current) return;
    pending.current = true; setResetting(true); setError(''); setNotice('');
    try {
      const data = await feedRequest('/reset', { method: 'POST', body: '{}' });
      if (!active.current) return;
      setEnvelope(data); setDraft(data.preferences); setResetConfirm(false);
      setNotice('Reading and search feedback cleared. Your bookmarks, followed topics, and communities still inform your feed.');
      onChange?.(data.preferences);
      window.dispatchEvent(new CustomEvent('dailycollabs:feed-preferences', { detail: data }));
    } catch (failure) { if (active.current) setError(failure.message); }
    finally { pending.current = false; if (active.current) setResetting(false); }
  }
  function requestClose(event) {
    event?.preventDefault();
    if (!busy) onClose();
  }

  return <dialog className="feed-tune-dialog" ref={ref} aria-labelledby={titleId} aria-describedby={introId} onCancel={requestClose} onClick={event => { if (event.currentTarget === event.target) requestClose(event); }}>
    <header className="feed-tune-header"><div><span className="feed-tune-eyebrow">LESS NOISE. MORE YOUR WORLD.</span><h2 id={titleId}>Tune your feed.</h2><p id={introId}>Make room for what interests you. Keep a little room for the unexpected.</p></div><button type="button" className="feed-tune-close" aria-label="Close feed controls" disabled={busy} onClick={requestClose}>×</button></header>
    <form onSubmit={save} aria-busy={busy}>
      <div className="feed-tune-body">
        {loading ? <div className="feed-tune-loading" role="status">Loading your feed preferences…</div> : draft && <fieldset className="feed-tune-fieldset" disabled={busy}>
          <section className="feed-tune-section feed-tune-row"><div><h3>Personalized recommendations</h3><p>Use your reading choices, saves, and communities to shape your feed.</p></div><label className="feed-tune-switch"><input type="checkbox" checked={draft.personalized} aria-label="Personalized recommendations" onChange={event => change('personalized', event.target.checked)} /><span aria-hidden="true" /></label></section>
          <section className="feed-tune-section"><fieldset className="feed-tune-modes" disabled={!draft.personalized}><legend>Set the balance</legend><div className="feed-tune-mode-grid">{MODES.map(mode => <label className="feed-tune-mode" key={mode.id}><input type="radio" name="feed-mode" value={mode.id} checked={draft.mode === mode.id} onChange={() => change('mode', mode.id)} /><strong>{mode.label}</strong><small>{mode.detail}</small></label>)}</div></fieldset></section>
          <section className="feed-tune-section"><label className="feed-tune-range"><span className="feed-tune-range-label"><span>Freshness</span><output>{Math.round(draft.freshness * 100)}%</output></span><input type="range" min="0" max="100" step="5" disabled={!draft.personalized || draft.mode === 'fresh'} value={Math.round(draft.freshness * 100)} aria-label="Feed freshness preference" aria-valuetext={`${Math.round(draft.freshness * 100)} percent emphasis on recent stories`} onChange={event => change('freshness', Number(event.target.value) / 100)} /><span className="feed-tune-range-extents"><span>Good stories at any age</span><span>Latest first</span></span></label><label className="feed-tune-range"><span className="feed-tune-range-label"><span>Source variety</span><output>{Math.round(draft.diversity * 100)}%</output></span><input type="range" min="0" max="100" step="5" disabled={!draft.personalized || draft.mode === 'fresh'} value={Math.round(draft.diversity * 100)} aria-label="Feed source diversity preference" aria-valuetext={`${Math.round(draft.diversity * 100)} percent source variety`} onChange={event => change('diversity', Number(event.target.value) / 100)} /><span className="feed-tune-range-extents"><span>A familiar mix</span><span>More different sources</span></span></label>{(!draft.personalized || draft.mode === 'fresh') && <p className="feed-tune-footnote">Fresh mode orders stories by publication time. Relevance and variety controls apply with personalization in another mode.</p>}</section>
          <section className="feed-tune-section"><h3>Followed topics</h3><p>Tell us what you want more of. Followed topics stay in your preferences when you reset learned history.</p><div className="feed-tune-input-row"><input type="text" dir="auto" value={followInput} maxLength={80} placeholder="Follow an interest" aria-label="Topic to follow" onChange={event => setFollowInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addFollowedTopic(); } }} /><button type="button" className="feed-tune-secondary" disabled={!followInput.trim() || draft.followedTopics.length >= 30} onClick={addFollowedTopic}>Follow topic</button></div><div className="feed-tune-chips">{draft.followedTopics.map(topic => <span className="feed-tune-chip" key={topic}><span dir="auto">{topic}</span><button type="button" aria-label={`Unfollow ${topic}`} onClick={() => change('followedTopics', draft.followedTopics.filter(item => item !== topic))}>×</button></span>)}</div><p className="feed-tune-footnote">{draft.followedTopics.length}/30 followed topics.</p></section>
          <section className="feed-tune-section"><h3>Topics you would rather skip</h3><p>Muted topics stay out of your recommendations. You can remove them whenever you like.</p><div className="feed-tune-input-row"><input type="text" dir="auto" value={muteInput} maxLength={80} placeholder="Add a topic to mute" aria-label="Topic to mute" onChange={event => setMuteInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addMutedTopic(); } }} /><button type="button" className="feed-tune-secondary" disabled={!muteInput.trim() || draft.mutedTopics.length >= 20} onClick={addMutedTopic}>Mute topic</button></div><div className="feed-tune-chips">{draft.mutedTopics.map(topic => <span className="feed-tune-chip" key={topic}><span dir="auto">{topic}</span><button type="button" aria-label={`Unmute ${topic}`} onClick={() => change('mutedTopics', draft.mutedTopics.filter(item => item !== topic))}>×</button></span>)}</div><p className="feed-tune-footnote">{draft.mutedTopics.length}/20 muted topics. Changes take effect when you save.</p></section>
          <section className="feed-tune-section"><h3>Your current interests</h3><p>Drawn from your feedback, bookmarks, followed topics, and communities.</p>{envelope.interests.length ? <div className="feed-tune-chips">{envelope.interests.slice(0, 12).map((interest, index) => <span key={`${interest.topic}-${index}`} className="feed-tune-interest" dir="auto"><strong>{interest.topic}</strong>{typeof interest.source === 'string' && <small>{interest.source.replaceAll('_', ' ')}</small>}</span>)}</div> : <p className="feed-tune-footnote">Interests will appear as you choose stories, follow topics, and join communities.</p>}<p className="feed-tune-footnote">{envelope.signalsCount} recent reading and search {envelope.signalsCount === 1 ? 'signal' : 'signals'}.</p></section>
          <section className="feed-tune-section"><h3>A fresh start</h3><p>Clear learned reading feedback. Your bookmarks, followed topics, and community memberships stay saved and can still inform recommendations.</p>{resetConfirm ? <div className="feed-tune-reset-confirm"><p>Clear your reading, searches, and “more / less like this” feedback? Your saved content and communities will stay in place. Any unsaved controls above will return to their saved values.</p><div><button type="button" className="feed-tune-secondary" onClick={() => setResetConfirm(false)}>Keep my history</button><button type="button" className="feed-tune-reset" onClick={resetHistory}>{resetting ? 'Clearing…' : 'Clear learned history'}</button></div></div> : <button type="button" className="feed-tune-reset" onClick={() => setResetConfirm(true)}>Reset learned history</button>}</section>
        </fieldset>}
        {error && <div className="feed-tune-feedback error" role="alert"><span>{error}</span>{!draft && !loading && <button type="button" className="feed-tune-secondary" onClick={() => setRetry(value => value + 1)}>Try again</button>}</div>}
        {notice && <div className="feed-tune-feedback success" role="status">{notice}</div>}
      </div>
      <footer className="feed-tune-footer"><span>{busy ? 'Updating your feed…' : dirty ? 'You have unsaved changes' : 'Your feed, your choices'}</span><div><button type="button" className="feed-tune-secondary" disabled={busy} onClick={requestClose}>Done</button><button type="submit" className="feed-tune-primary" disabled={!dirty || busy || loading}>{saving ? 'Saving…' : 'Save preferences'}</button></div></footer>
    </form>
  </dialog>;
}

export function WhyThisStory({ reasons, className = '' }) {
  const explanations = Array.isArray(reasons) ? reasons.filter(reason => typeof reason === 'string' && reason.trim()).slice(0, 5) : [];
  if (!explanations.length) return null;
  return <details className={`feed-story-reasons ${className}`}><summary>Why this story?</summary><ul>{explanations.map((reason, index) => <li key={`${reason}-${index}`} dir="auto">{reason}</li>)}</ul></details>;
}

export default function FeedControls({ onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={`feed-tune-trigger ${className}`} onClick={() => setOpen(true)}><TuneIcon />Tune your feed</button>{open && <FeedDialog onClose={() => setOpen(false)} onChange={onChange} />}</>;
}
