import { useCallback, useEffect, useRef, useState } from 'react';
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ThumbDownOffAltIcon from '@mui/icons-material/ThumbDownOffAlt';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import LinkIcon from '@mui/icons-material/Link';
import SearchBar from '../Searchbar/Searchbar';
import VideoFeed from './VideoFeed';
import VideoPlayer from './VideoPlayer';
import ArticleArtwork from '../Artwork/ArticleArtwork';
import TopicVideos from '../Search/TopicVideos';
import FeedControls, { WhyThisStory } from '../FeedControls/FeedControls';
import { sendFeedSignal } from '../FeedControls/feedSignals';
import { DraggableCard, CommunityTags } from '../CardActions';
import { BOOKMARK_EVENT, loadBookmarks, readBookmarks, toggleBookmark } from '../../lib/bookmarks';
import { getArticleVideo } from '../../lib/media';
import { readCachedProfile, PROFILE_EVENT } from '../../lib/profile';
import { API_URL } from '../../config';
import './Home.css';

function uniqueStories(stories) {
  const seen = new Set();
  return stories.filter(story => story?.link && !seen.has(story.link) && seen.add(story.link));
}

export default function Home() {
  const token = sessionStorage.getItem('token');
  const [currentUser, setCurrentUser] = useState(readCachedProfile);
  const [topicVideos, setTopicVideos] = useState({ videos: [], query: '', status: 'idle' });
  const [searchReset, setSearchReset] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchLocale, setSearchLocale] = useState({ language: 'auto', region: '' });
  const [feedMode, setFeedMode] = useState('all');
  const feedModeRef = useRef('all');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQuery, setCurrentQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userReactions, setUserReactions] = useState({});
  const [reactionCounts, setReactionCounts] = useState({});
  const [bookmarkedArticles, setBookmarkedArticles] = useState(() => new Set(readBookmarks().map(item => item.link)));
  const [feedbackBusy, setFeedbackBusy] = useState({});
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [hiddenStory, setHiddenStory] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const mounted = useRef(true);
  const sentinelRef = useRef(null);
  const localeRef = useRef(searchLocale);
  const queryRef = useRef('');
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const fetchingMore = useRef(false);
  const generation = useRef(0);
  const rankingSession = useRef(null);
  const controllers = useRef(new Set());
  const hiddenUrls = useRef(new Set());
  const feedbackRequests = useRef(new Set());
  const reactionRequests = useRef(new Set());
  const searchingRef = useRef(false);
  const pendingRefresh = useRef(false);
  const loadArticlesRef = useRef(null);
  const refreshRef = useRef(null);
  localeRef.current = searchLocale;
  feedModeRef.current = feedMode;

  const loadReactions = useCallback(async (stories, authToken) => {
    if (!authToken) return;
    const rows = await Promise.all(stories.map(async story => {
      try {
        const headers = { Authorization: `Bearer ${authToken}` };
        const [mine, counts] = await Promise.all([
          fetch(`${API_URL}/reactions/${encodeURIComponent(story.link)}/my`, { headers }).then(response => response.ok ? response.json() : null),
          fetch(`${API_URL}/reactions/${encodeURIComponent(story.link)}/count`, { headers }).then(response => response.ok ? response.json() : null),
        ]);
        return { url: story.link, mine, counts };
      } catch { return null; }
    }));
    if (!mounted.current || sessionStorage.getItem('token') !== authToken) return;
    const mine = {}; const counts = {};
    rows.filter(Boolean).forEach(row => { if (row.mine) mine[row.url] = row.mine.reaction || null; if (row.counts) counts[row.url] = row.counts; });
    setUserReactions(previous => ({ ...previous, ...mine }));
    setReactionCounts(previous => ({ ...previous, ...counts }));
  }, []);

  function cancelFeedRequests() {
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
    fetchingMore.current = false;
  }

  loadArticlesRef.current = async (query, page = 1, append = false, externalSignal) => {
    if (!append) { cancelFeedRequests(); rankingSession.current = null; }
    const requestId = append ? generation.current : ++generation.current;
    const authToken = sessionStorage.getItem('token');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    externalSignal?.addEventListener('abort', abort, { once: true });
    controllers.current.add(controller);
    try {
      const response = await fetch(`${API_URL}/rss`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ query, page, pageSize: 12, language: localeRef.current.language, region: localeRef.current.region || undefined, ...(feedModeRef.current === 'news' ? { modeOverride: 'fresh' } : {}), ...(append && rankingSession.current ? { rankingSession: rankingSession.current } : {}) }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Could not load your stories.');
      if (!mounted.current || controller.signal.aborted || requestId !== generation.current || sessionStorage.getItem('token') !== authToken) return;
      const stories = uniqueStories(Array.isArray(data.articles) ? data.articles : []).filter(story => !hiddenUrls.current.has(story.link));
      if (!append) rankingSession.current = data.rankingSession || null;
      queryRef.current = query; pageRef.current = page; hasMoreRef.current = Boolean(data.hasMore);
      setArticles(previous => append ? uniqueStories([...previous, ...stories]) : stories);
      setCurrentQuery(query); setHasMore(Boolean(data.hasMore)); setError('');
      loadReactions(stories, authToken);
      try { sessionStorage.setItem('cachedArticles', JSON.stringify(stories)); } catch { /* Server-backed bookmarks do not depend on this compatibility cache. */ }
      return data;
    } finally {
      controllers.current.delete(controller);
      externalSignal?.removeEventListener('abort', abort);
    }
  };

  refreshRef.current = async () => {
    if (searchingRef.current) { pendingRefresh.current = true; return; }
    setLoading(true); setError(''); setLoadingMore(false);
    const task = loadArticlesRef.current(queryRef.current, 1, false);
    const requestId = generation.current;
    try { await task; }
    catch (failure) { if (failure.name !== 'AbortError' && mounted.current && requestId === generation.current) setError(failure.message); }
    finally { if (mounted.current && requestId === generation.current) setLoading(false); }
  };

  useEffect(() => {
    mounted.current = true;
    const requests = controllers.current;
    const controller = new AbortController();
    const task = loadArticlesRef.current('', 1, false, controller.signal);
    const requestId = generation.current;
    task.catch(failure => { if (!controller.signal.aborted && requestId === generation.current) { setError(failure.message); setHasMore(false); hasMoreRef.current = false; } })
      .finally(() => { if (!controller.signal.aborted && requestId === generation.current) setLoading(false); });
    loadBookmarks().catch(() => {});
    return () => { mounted.current = false; controller.abort(); requests.forEach(item => item.abort()); };
  }, []);

  useEffect(() => {
    const profile = event => setCurrentUser(event.detail || readCachedProfile());
    const bookmarks = event => setBookmarkedArticles(new Set((event.detail || readBookmarks()).map(item => item.link)));
    const preferences = () => { hiddenUrls.current.clear(); setHiddenStory(null); refreshRef.current(); };
    window.addEventListener(PROFILE_EVENT, profile);
    window.addEventListener(BOOKMARK_EVENT, bookmarks);
    window.addEventListener('dailycollabs:feed-preferences', preferences);
    return () => { window.removeEventListener(PROFILE_EVENT, profile); window.removeEventListener(BOOKMARK_EVENT, bookmarks); window.removeEventListener('dailycollabs:feed-preferences', preferences); };
  }, []);

  const loadMore = useCallback(async () => {
    if (fetchingMore.current || !hasMoreRef.current || searchingRef.current) return;
    fetchingMore.current = true; setLoadingMore(true);
    const requestId = generation.current;
    try { await loadArticlesRef.current(queryRef.current, pageRef.current + 1, true); }
    catch (failure) { if (failure.name !== 'AbortError' && mounted.current && requestId === generation.current) setError(failure.message); }
    finally { if (requestId === generation.current) { fetchingMore.current = false; if (mounted.current) setLoadingMore(false); } }
  }, []);

  useEffect(() => {
    if (loading || feedMode === 'videos') return;
    const element = sentinelRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: '600px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [feedMode, loading, loadMore]);

  async function reactToStory(article, type) {
    const url = article.link;
    if (!token || reactionRequests.current.has(url)) return;
    reactionRequests.current.add(url); setFeedbackError('');
    try {
      const response = await fetch(`${API_URL}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ articleLink: url, type }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Your reaction could not be saved.');
      if (!mounted.current || sessionStorage.getItem('token') !== token) return;
      setUserReactions(previous => ({ ...previous, [url]: data.status?.includes('removed') ? null : type }));
      if (data.count) setReactionCounts(previous => ({ ...previous, [url]: data.count }));
    } catch (failure) { if (mounted.current) setFeedbackError(failure.message); }
    finally { reactionRequests.current.delete(url); }
  }

  async function bookmarkStory(article) {
    try { await toggleBookmark(article); }
    catch (failure) { if (mounted.current) setFeedbackError(failure.message); }
  }
  async function copyStory(url) {
    try { await navigator.clipboard.writeText(url); setFeedbackNotice('Story link copied.'); }
    catch { setFeedbackError('The link could not be copied. Open the story and copy its address.'); }
  }
  function openStory(article) {
    // The outbound link remains a normal link, including modifier/middle clicks.
    sendFeedSignal('open', { url: article.link, title: article.title }).catch(() => {});
  }
  async function feedback(article, type) {
    const url = article.link;
    if (feedbackRequests.current.has(url)) return;
    feedbackRequests.current.add(url); setFeedbackBusy(previous => ({ ...previous, [url]: true })); setFeedbackError(''); setFeedbackNotice('');
    const originQuery = queryRef.current;
    const index = articles.findIndex(item => item.link === url);
    try {
      const saved = await sendFeedSignal(type, { url, title: article.title });
      if (!saved.recorded) throw new Error('Sign in to save feed feedback.');
      if (!mounted.current) return;
      if (type === 'hide') {
        hiddenUrls.current.add(url); setArticles(previous => previous.filter(item => item.link !== url));
        setHiddenStory({ article, index, query: originQuery });
      } else {
        setFeedbackNotice(type === 'more' ? 'Preference saved: more like this.' : 'Preference saved: less like this.');
        await refreshRef.current();
      }
    } catch (failure) { if (mounted.current) setFeedbackError(failure.message); }
    finally { feedbackRequests.current.delete(url); if (mounted.current) setFeedbackBusy(previous => ({ ...previous, [url]: false })); }
  }
  async function undoHide() {
    if (!hiddenStory || undoing) return;
    const hidden = hiddenStory; setUndoing(true); setFeedbackError('');
    try {
      const saved = await sendFeedSignal('unhide', { url: hidden.article.link, title: hidden.article.title });
      if (!saved.recorded) throw new Error('Sign in to restore this story.');
      if (!mounted.current) return;
      hiddenUrls.current.delete(hidden.article.link);
      if (queryRef.current === hidden.query) setArticles(previous => {
        if (previous.some(item => item.link === hidden.article.link)) return previous;
        const next = [...previous]; next.splice(Math.max(0, Math.min(hidden.index, next.length)), 0, hidden.article); return next;
      });
      setHiddenStory(null); setFeedbackNotice('Story restored.');
    } catch (failure) { if (mounted.current) setFeedbackError(failure.message); }
    finally { if (mounted.current) setUndoing(false); }
  }

  function searchResults(payload) {
    cancelFeedRequests(); ++generation.current;
    rankingSession.current = payload.rankingSession || null;
    if (payload.language) { const locale = { language: payload.language, region: payload.region || '' }; localeRef.current = locale; setSearchLocale(locale); }
    const stories = uniqueStories(payload.articles || []).filter(story => !hiddenUrls.current.has(story.link));
    queryRef.current = payload.query || ''; pageRef.current = payload.page || 1; hasMoreRef.current = Boolean(payload.hasMore);
    setArticles(stories); setCurrentQuery(queryRef.current); setHasMore(hasMoreRef.current); setLoading(false); setLoadingMore(false); setError(payload.newsMessage || '');
    setTopicVideos({ videos: payload.videos || [], query: payload.query || '', status: payload.videoStatus || 'ok', message: payload.videoMessage || '', provider: payload.videoProvider || '', searchUrl: payload.searchUrl || '' });
    searchingRef.current = false; setSearching(false); loadReactions(stories, token);
    if (pendingRefresh.current) { pendingRefresh.current = false; refreshRef.current(); }
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reducedMotion === 'true' ? 'auto' : 'smooth' });
  }
  function searchState({ loading: pending, query, cancelled, language, region }) {
    if (language) { const locale = { language, region: region || '' }; localeRef.current = locale; setSearchLocale(locale); }
    searchingRef.current = pending; setSearching(pending);
    if (pending) {
      cancelFeedRequests(); ++generation.current; rankingSession.current = null;
      queryRef.current = query; hasMoreRef.current = false;
      setCurrentQuery(query); setArticles([]); setHasMore(false); setLoading(false); setLoadingMore(false); setError('');
      setTopicVideos({ videos: [], query, status: 'loading' });
    }
    if (cancelled) setTopicVideos({ videos: [], query, status: 'unavailable', message: 'Search cancelled. Search again when you are ready.' });
    else if (!pending) setTopicVideos(previous => previous.status === 'loading' ? { ...previous, status: 'unavailable', message: 'Search could not finish. Please try again.' } : previous);
  }
  function clearTopic() {
    searchingRef.current = false; pendingRefresh.current = false; setSearching(false); setSearchReset(value => value + 1);
    queryRef.current = ''; setCurrentQuery(''); setTopicVideos({ videos: [], query: '', status: 'idle' });
    refreshRef.current();
  }
  function chooseView(mode) {
    const changesRanking = (feedModeRef.current === 'news') !== (mode === 'news');
    feedModeRef.current = mode; setFeedMode(mode);
    if (changesRanking) refreshRef.current();
  }

  return <div className="home-page"><div className="home-container">
    <header className="home-page-heading"><div><span className="home-eyebrow">THE DAILY COLLECTIVE</span><h1>Your daily perspective<span className="home-heading-dot">.</span></h1><p>Good stories. Fresh ideas. People who get it.</p></div><div className="home-heading-controls"><FeedControls /><span className="home-live-label"><span /> LIVE FEED</span></div></header>
    <SearchBar key={searchReset} modeOverride={feedMode === 'news' ? 'fresh' : undefined} initialLanguage={searchLocale.language} initialRegion={searchLocale.region} onResults={searchResults} onSearchState={searchState} onVideoResults={payload => setTopicVideos({ videos: payload.videos || [], query: payload.query || '', status: payload.status || payload.videoStatus || 'ok', message: payload.message || payload.videoMessage || '', provider: payload.provider || payload.videoProvider || '', searchUrl: payload.searchUrl || '' })} token={token} userId={currentUser?._id} />
    {currentQuery && <div className="home-topic-context"><span>Exploring <strong dir="auto">#{currentQuery}</strong> across stories and videos</span><button type="button" onClick={clearTopic}>Clear topic ×</button></div>}
    <nav className="home-feed-tabs" aria-label="Home feed filter">{[['all', 'For you'], ['news', 'Latest news'], ['videos', 'Videos']].map(([value, label]) => <button key={value} className={feedMode === value ? 'is-active' : ''} aria-pressed={feedMode === value} onClick={() => chooseView(value)}>{label}{value === 'videos' && <span className="home-tab-new">NEW</span>}</button>)}</nav>
    {feedbackError && <p className="home-feed-feedback error" role="alert">{feedbackError}<button type="button" aria-label="Dismiss feedback error" onClick={() => setFeedbackError('')}>×</button></p>}
    {feedbackNotice && <p className="home-feed-feedback" role="status">{feedbackNotice}<button type="button" aria-label="Dismiss feedback confirmation" onClick={() => setFeedbackNotice('')}>×</button></p>}
    {hiddenStory && <div className="home-feed-feedback home-hidden-story" role="status"><span>Hidden <strong dir="auto">{hiddenStory.article.title}</strong></span><button type="button" disabled={undoing} onClick={undoHide}>{undoing ? 'Restoring…' : 'Undo hide'}</button></div>}
    {feedMode !== 'news' && (currentQuery ? <TopicVideos {...topicVideos} autoplayMuted={feedMode === 'all'} /> : <VideoFeed compact={feedMode === 'all'} autoplayMuted={feedMode === 'all'} />)}
    {feedMode !== 'videos' && <section className="home-news-section" aria-labelledby="home-news-heading"><div className="home-section-heading"><div><span className="home-eyebrow">STAY CURIOUS</span><h2 id="home-news-heading" dir="auto">{currentQuery ? `Exploring ${currentQuery}` : 'On your radar'}<span className="home-heading-dot">.</span></h2></div><span className="home-news-count">{articles.length ? `${articles.length} stories` : ''}</span></div>
      {loading && <div className="home-news-loading" role="status"><span className="home-loading-dot" /> Finding stories worth your time…</div>}
      {error && <p className="home-feed-error" role="status">{error} <button type="button" className="home-inline-refresh" onClick={() => refreshRef.current()}>Refresh stories</button></p>}
      {!loading && !searching && !error && !articles.length && <p className="home-empty-state">No stories here yet. Try another topic or adjust your feed preferences.</p>}
      <div className="grid-container">{articles.map(article => {
        const reaction = userReactions[article.link]; const counts = reactionCounts[article.link]; const articleVideo = getArticleVideo(article);
        const shared = { title: article.title || 'A story worth sharing', url: articleVideo?.url || article.link, image: article.image, description: article.description || '', type: articleVideo ? 'video' : 'article' };
        return <div key={article.link} className="card-content"><DraggableCard content={shared}><article className="card"><div className="card-header"><div className="button-wrapper"><a href={article.link} target="_blank" rel="noopener noreferrer" className="button" onClick={() => openStory(article)} onAuxClick={event => { if (event.button === 1) openStory(article); }}>Read story ↗</a></div><h3 className="head" dir="auto" lang={article.language || article.lang || undefined}>{article.title || 'Untitled'}</h3><div className="content"><p className="home-article-date">{article.sourceTitle && <span dir="auto">{article.sourceTitle} · </span>}{article.pubDate && !Number.isNaN(Date.parse(article.pubDate)) ? new Date(article.pubDate).toLocaleDateString() : ''}</p>{article.description && <p className="home-article-description" dir="auto" lang={article.language || article.lang || undefined}>{article.description.length > 170 ? `${article.description.slice(0, 170)}…` : article.description}</p>}<WhyThisStory reasons={article.reasons} /><div className="bottom-section">{articleVideo ? <VideoPlayer url={articleVideo.url} title={article.title} autoplayMuted={feedMode === 'all'} /> : <ArticleArtwork src={article.image} url={article.link} title={article.title} topic={article.imageTopic || currentQuery} isTopicImage={article.isTopicImage} credit={article.imageCredit} imagePage={article.imagePage} />}<CommunityTags content={shared} /><div className="action-buttons"><button type="button" aria-label={reaction === 'like' ? 'Remove like' : 'Like story'} aria-pressed={reaction === 'like'} onClick={() => reactToStory(article, 'like')} className={reaction === 'like' ? 'btn-liked' : 'btn-unliked'}>{reaction === 'like' ? <ThumbUpAltIcon /> : <ThumbUpOffAltIcon />}<span>{typeof counts?.likes === 'number' ? counts.likes : '—'}</span></button><button type="button" aria-label={reaction === 'dislike' ? 'Remove dislike' : 'Dislike story'} aria-pressed={reaction === 'dislike'} onClick={() => reactToStory(article, 'dislike')} className={reaction === 'dislike' ? 'btn-disliked' : 'btn-disdisliked'}>{reaction === 'dislike' ? <ThumbDownAltIcon /> : <ThumbDownOffAltIcon />}<span>{typeof counts?.dislikes === 'number' ? counts.dislikes : '—'}</span></button><button type="button" aria-label={bookmarkedArticles.has(article.link) ? 'Remove bookmark' : 'Bookmark story'} aria-pressed={bookmarkedArticles.has(article.link)} onClick={() => bookmarkStory(article)} className={bookmarkedArticles.has(article.link) ? 'btn-bookmarked' : 'btn-unbookmark'}>{bookmarkedArticles.has(article.link) ? <BookmarkAddedIcon /> : <BookmarkAddIcon />}</button><button type="button" aria-label="Copy story link" onClick={() => copyStory(article.link)} className="btn-cpylink"><LinkIcon /></button></div><div className="home-story-feedback" aria-label={`Tune recommendations for ${article.title}`}><button type="button" disabled={feedbackBusy[article.link]} onClick={() => feedback(article, 'more')}>＋ More like this</button><button type="button" disabled={feedbackBusy[article.link]} onClick={() => feedback(article, 'less')}>− Less like this</button><button type="button" disabled={feedbackBusy[article.link]} onClick={() => feedback(article, 'hide')}>Hide</button></div></div></div></div></article></DraggableCard></div>;
      })}</div>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {loadingMore && <p className="home-feed-tail" role="status">Loading more stories…</p>}
      {!hasMore && articles.length > 0 && <p className="home-feed-tail">You’re all caught up.</p>}
    </section>}
  </div></div>;
}
