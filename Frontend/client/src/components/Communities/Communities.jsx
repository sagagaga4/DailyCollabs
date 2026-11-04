import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CommunityDialog from './CommunityDialog';
import { communityRequest } from './communityApi';
import './Communities.css';

const categories = ['Technology', 'Gaming', 'Music', 'Film & TV', 'Art & Design', 'Science', 'Lifestyle', 'Other'];

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('discover');
  const [sort, setSort] = useState('featured');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState('');
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();
  const errorRef = useRef(null);
  const formErrorRef = useRef(null);

  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
    else if (error) errorRef.current?.focus();
  }, [error, formError]);

  useEffect(() => {
    let active = true;
    communityRequest().then(data => { if (active) setCommunities(Array.isArray(data) ? data : []); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = communities.filter(item => (tab !== 'joined' || item.isMember) && `${item.name} ${item.description} ${item.category} ${item.board}`.toLowerCase().includes(query.toLowerCase().trim())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'members' ? b.memberCount - a.memberCount || a.name.localeCompare(b.name) : 0);
  const joinedCount = communities.filter(item => item.isMember).length;

  async function join(community) {
    if (community.requiresRulesAcceptance) { navigate(`/Communities/${community._id}?channel=welcome`); return; }
    setBusy(community._id); setNotice(''); setError('');
    try {
      const updated = await communityRequest(`/${community._id}/join`, { method: 'POST', body: '{}' });
      setCommunities(items => items.map(item => item._id === updated._id ? updated : item));
      setNotice(`You joined ${community.name}. Your next conversation is waiting.`);
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }

  async function create(event) {
    event.preventDefault(); setBusy('create'); setFormError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const community = await communityRequest('', { method: 'POST', body: JSON.stringify(data) });
      navigate(`/Communities/${community._id}`);
    } catch (err) { setFormError(err.message); }
    finally { setBusy(''); }
  }

  return <section className="communities-page">
    <header className="communities-page-header">
      <div><p className="community-eyebrow">A little less scrolling. A little more belonging.</p><h1>Communities<span className="community-title-dot">.</span></h1><p className="community-page-intro">Find your corner of the internet. Build something together.</p></div>
      <button className="community-button primary" onClick={() => { setFormError(''); setCreating(true); }}><span aria-hidden="true">＋</span> Create community</button>
    </header>

    <div className="community-feature-banner"><div><span className="community-small-label">CURIOSITY LOOKS GOOD ON YOU</span><h2>Big interests. Your kind of people.</h2><p>From technology to late-night album discussions, there is a board for that.</p></div><div className="community-banner-symbols" aria-hidden="true"><span>⌘</span><span>♫</span><span>✳</span></div></div>

    <div className="community-toolbar">
      <div className="community-tabs" aria-label="Community views"><button className={tab === 'discover' ? 'selected' : ''} aria-pressed={tab === 'discover'} onClick={() => setTab('discover')}>Discover <span>{communities.length}</span></button><button className={tab === 'joined' ? 'selected' : ''} aria-pressed={tab === 'joined'} onClick={() => setTab('joined')}>Your communities <span>{joinedCount}</span></button></div>
      <div className="community-find-controls"><label className="community-sort"><span className="community-sr-only">Sort communities</span><select aria-label="Sort communities" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">Featured first</option><option value="name">Name A–Z</option><option value="members">Most members</option></select></label><label className="community-search"><span aria-hidden="true">⌕</span><input aria-label="Search communities" type="search" placeholder="Search your interests" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    </div>
    {error && <div ref={errorRef} tabIndex={-1} className="community-message error" role="alert">{error}<button onClick={() => window.location.reload()}>Try again</button></div>}
    {notice && <p className="community-message success" role="status">{notice}</p>}

    {loading ? <div className="community-grid" aria-label="Loading communities" aria-busy="true">{[1, 2, 3, 4, 5].map(id => <div className="community-skeleton" key={id}><span /><span /><span /></div>)}</div> : <>
      <div className="community-grid-label"><h2>{tab === 'joined' ? 'Your spaces' : query ? 'Search results' : 'Explore the boards'}</h2><span role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'community' : 'communities'}</span></div>
      <div className="community-grid">{filtered.map(community => <article className="community-card" key={community._id} style={{ '--board-accent': community.accent }}>
        <div className="community-card-top"><span className="community-board-icon" aria-hidden="true">{community.icon}</span><span className="community-board-code">/{community.board}/</span>{community.isDemo && <span className="community-demo-label">Demo board</span>}</div>
        <div className="community-card-copy"><span className="community-card-category">{community.category}</span><h3><Link to={`/Communities/${community._id}`}>{community.name}</Link></h3><p dir="auto">{community.description}</p></div>
        <div className="community-card-stats"><span><span aria-hidden="true">◎</span> {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}</span><span>{community.messageCount ?? community.discussionCount} {(community.messageCount ?? community.discussionCount) === 1 ? 'message' : 'messages'}</span></div>
        <div className="community-card-footer"><Link to={`/Communities/${community._id}`}>Explore board <span aria-hidden="true">↗</span></Link>{community.isMember ? <Link className="community-button joined" to={`/Communities/${community._id}`}><span aria-hidden="true">✓</span> {community.isOwner ? 'Your board' : 'Joined'}</Link> : <button className="community-button join" disabled={Boolean(busy)} onClick={() => join(community)}>{busy === community._id ? 'Joining…' : 'Join community'}</button>}</div>
      </article>)}</div>
      {!filtered.length && !error && <div className="community-empty"><span aria-hidden="true">◎</span><h2>{tab === 'joined' ? 'Your people are out there.' : 'A new interest deserves a new space.'}</h2><p>{query ? `No communities match “${query}”. Try another topic or start your own.` : tab === 'joined' ? 'Explore the boards and join a conversation that feels like you.' : 'Create the first community and invite people who share your interests.'}</p><button className="community-button primary" onClick={() => { if (tab === 'joined') setTab('discover'); else setCreating(true); }}>{tab === 'joined' ? 'Discover communities' : 'Create community'}</button></div>}
    </>}
    <footer className="community-page-footnote"><span aria-hidden="true">✳</span> Better conversations start with a shared curiosity. Demo boards contain sample opening conversations; member counts are real.</footer>

    {creating && <CommunityDialog title="Create your corner" description="Give people a reason to gather. You will be the first member." dismissible={busy !== 'create'} onClose={() => setCreating(false)}><form className="community-form" onSubmit={create} aria-busy={busy === 'create'}>
      <label>Community name<input autoFocus name="name" dir="auto" required minLength={3} maxLength={60} placeholder="e.g. The Open Source Club" /></label>
      <div className="community-form-row"><label>Board code<span className="community-field-help">Letters and numbers, up to 12</span><input name="board" maxLength={12} pattern="[A-Za-z0-9]{1,12}" placeholder="e.g. oss" /></label><label>Category<select name="category">{categories.map(category => <option key={category}>{category}</option>)}</select></label></div>
      <label>Description<textarea name="description" dir="auto" required minLength={10} maxLength={500} rows={4} placeholder="What brings your community together?" /></label>
      <div className="community-form-note">Public community · Anyone can discover and join.</div>
      {formError && <p ref={formErrorRef} tabIndex={-1} className="community-message error" role="alert">{formError}</p>}
      <div className="community-dialog-actions"><button type="button" className="community-button secondary" disabled={busy === 'create'} onClick={() => setCreating(false)}>Cancel</button><button className="community-button primary" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Create community'}</button></div>
    </form></CommunityDialog>}
  </section>;
}
