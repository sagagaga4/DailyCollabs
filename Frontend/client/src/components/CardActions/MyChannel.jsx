import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import VideoPlayer from '../Home/VideoPlayer';
import ArticleArtwork from '../Artwork/ArticleArtwork';
import DraggableCard from './DraggableCard';
import CommunityTags from './CommunityTags';
import { contentRequest } from './contentApi';
import { useCardActions } from './useCardActions';
import './CardActions.css';

export default function MyChannel() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { notify } = useCardActions();

  useEffect(() => {
    let active = true;
    setLoading(true);
    contentRequest('/content/channel').then((data) => { if (active) { setPosts(data.posts || []); setPage(data.page); setHasMore(Boolean(data.hasMore)); setError(''); } })
      .catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => { const sync = () => setRefresh((value) => value + 1); window.addEventListener('dailycollabs:content', sync); return () => window.removeEventListener('dailycollabs:content', sync); }, []);

  async function remove(id) {
    if (!window.confirm('Remove this repost from your channel?')) return;
    setBusy(id); setError('');
    try { await contentRequest(`/content/channel/${id}`, { method: 'DELETE' }); setPosts((previous) => previous.filter((post) => post._id !== id)); notify('Removed from your channel.'); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(''); }
  }
  async function more() {
    setBusy('more'); setError('');
    try { const data = await contentRequest(`/content/channel?page=${page + 1}`); setPosts((previous) => [...previous, ...(data.posts || []).filter((post) => !previous.some((item) => item._id === post._id))]); setPage(data.page); setHasMore(Boolean(data.hasMore)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(''); }
  }

  return <section className="dc-my-channel"><header><span>COLLECT YOUR CURIOSITY</span><h1>My channel.</h1><p>Your personal collection of stories and videos. Repost something worth keeping, add your take, then bring it into a community.</p></header>
    {error && <p className="dc-action-error" role="alert">{error} <button onClick={() => setRefresh((value) => value + 1)}>Try again</button></p>}
    {loading ? <p role="status">Loading your channel…</p> : posts.length ? <><div className="dc-channel-grid">{posts.map((post) => <DraggableCard content={post.content} key={post._id}><article className="dc-channel-card">{post.content.type === 'video' ? <div className="home-page"><VideoPlayer url={post.content.url} title={post.content.title} /></div> : <ArticleArtwork src={post.content.image} url={post.content.url} title={post.content.title} />}<div className="dc-channel-body"><div className="dc-channel-meta"><span>{post.content.type === 'video' ? 'VIDEO' : 'STORY'} · REPOSTED BY YOU</span><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div><h2><a href={post.content.url} target="_blank" rel="noopener noreferrer">{post.content.title}</a></h2>{post.content.description && <p>{post.content.description}</p>}{post.note && <blockquote className="dc-channel-note">{post.note}</blockquote>}<CommunityTags content={post.content} /><div className="dc-channel-card-footer"><a href={post.content.url} target="_blank" rel="noopener noreferrer">Open original ↗</a><button disabled={busy === post._id} onClick={() => remove(post._id)}>{busy === post._id ? 'Removing…' : 'Remove repost'}</button></div></div></article></DraggableCard>)}</div>{hasMore && <button className="dc-channel-more" onClick={more} disabled={busy === 'more'}>{busy === 'more' ? 'Loading…' : 'Load more'}</button>}</> : !error && <div className="dc-channel-empty"><h2>A space for your next discovery.</h2><p>Open a card’s ••• menu and choose “Repost to my channel.”<br />Your collection is saved to your account and stays here when you return.</p><Link to="/">Find something worth keeping ↗</Link></div>}
  </section>;
}
