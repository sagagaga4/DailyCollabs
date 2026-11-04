import { useEffect, useRef, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import { API_URL } from '../../config';
import PixelSearch from '../Search/PixelSearch';
import { NEWS_LANGUAGES, canonicalLanguage } from '../../lib/languages';
import { sendFeedSignal } from '../FeedControls/feedSignals';
import './SearchBar.css';

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'The request could not finish.');
  return data;
}

export default function SearchBar({ onResults, onVideoResults, onSearchState, userId, token, initialLanguage = 'auto', initialRegion = '', modeOverride }) {
  const [query, setQuery] = useState('');
  const [languageChoice, setLanguageChoice] = useState(() => NEWS_LANGUAGES.some(([code]) => code === initialLanguage) ? initialLanguage : 'custom');
  const [customLanguage, setCustomLanguage] = useState(() => canonicalLanguage(initialLanguage) || '');
  const [region, setRegion] = useState(initialRegion);
  const [localeMessage, setLocaleMessage] = useState('');
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeQuery, setActiveQuery] = useState('');
  const [error, setError] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  const request = useRef(null);
  const generation = useRef(0);
  const callbacks = useRef({ onResults, onVideoResults, onSearchState });
  callbacks.current = { onResults, onVideoResults, onSearchState };

  useEffect(() => {
    const controller = new AbortController();
    const authToken = sessionStorage.getItem('token') || token;
    setTags([]);
    if (!authToken) return () => controller.abort();
    jsonRequest(`${API_URL}/tags`, { headers: { Authorization: `Bearer ${authToken}` }, signal: controller.signal }).then(data => { if (!controller.signal.aborted) setTags(Array.isArray(data) ? data : []); }).catch(() => {});
    return () => controller.abort();
  }, [token]);
  useEffect(() => () => { generation.current += 1; request.current?.abort(); }, []);

  async function search(event, selectedQuery) {
    event?.preventDefault();
    const topic = (selectedQuery || query).replace(/\s+/g, ' ').trim();
    if ([...topic].some(character => { const point = character.codePointAt(0); return point < 32 || point === 127 || (point >= 8234 && point <= 8238) || (point >= 8294 && point <= 8297); })) { setError('Use a plain text topic without control characters.'); return; }
    const language = languageChoice === 'custom' ? canonicalLanguage(customLanguage) : languageChoice;
    if (!language) { setError('Enter a valid language code, such as he, ar, or fr-CA.'); return; }
    if (region && !/^[A-Za-z]{2}$/.test(region)) { setError('Use a two-letter region code.'); return; }
    if (topic.length < 2 || topic.length > 120) { setError('Search for a topic between 2 and 120 characters.'); return; }
    const authToken = sessionStorage.getItem('token') || token;
    const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    sendFeedSignal('search', { query: topic }).catch(() => {});
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const current = ++generation.current;
    setQuery(topic); setActiveQuery(topic); setLoading(true); setError(''); setLocaleMessage('');
    callbacks.current.onSearchState?.({ loading: true, query: topic, language, region });
    const timeout = setTimeout(() => controller.abort('timeout'), 26000);
    try {
      const videoPromise = jsonRequest(`${API_URL}/video-search?${new URLSearchParams({ q: topic, language, ...(region ? { region } : {}) })}`, { headers: authHeaders, signal: controller.signal });
      videoPromise.then(data => {
        if (current === generation.current) callbacks.current.onVideoResults?.({ query: topic, language, region, videos: Array.isArray(data.videos) ? data.videos : [], status: data.status || 'unavailable', message: data.message || '', provider: data.provider || 'YouTube', searchUrl: data.searchUrl });
      }, () => {
        if (current === generation.current) callbacks.current.onVideoResults?.({ query: topic, language, region, videos: [], status: 'unavailable', message: 'Video search could not finish. Try again or explore this topic on YouTube.', provider: 'YouTube' });
      });
      const [news, media] = await Promise.allSettled([
        jsonRequest(`${API_URL}/rss`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ query: topic, page: 1, pageSize: 12, language, ...(region ? { region } : {}), ...(modeOverride === 'fresh' ? { modeOverride: 'fresh' } : {}) }), signal: controller.signal }),
        videoPromise,
      ]);
      if (current !== generation.current) return;
      const articles = news.status === 'fulfilled' && Array.isArray(news.value.articles) ? news.value.articles : [];
      const videos = media.status === 'fulfilled' && Array.isArray(media.value.videos) ? media.value.videos : [];
      const videoStatus = media.status === 'fulfilled' ? media.value.status : 'unavailable';
      const videoMessage = media.status === 'fulfilled' ? media.value.message || '' : 'Video search is temporarily unavailable. Explore the topic directly on YouTube.';
      setLocaleMessage(news.status === 'fulfilled' ? news.value.message || news.value.locale?.message || '' : '');
      callbacks.current.onResults?.({ articles, query: topic, language, region, locale: news.status === 'fulfilled' ? news.value.locale : undefined, rankingSession: news.status === 'fulfilled' ? news.value.rankingSession : undefined, page: 1, hasMore: news.status === 'fulfilled' && Boolean(news.value.hasMore),
        videos, videoStatus, videoMessage, videoProvider: media.status === 'fulfilled' ? media.value.provider : 'YouTube',
        searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`,
        newsMessage: news.status === 'rejected' ? 'News search could not finish. Please try again.' : '' });
      if (news.status === 'rejected' && videos.length) setError('Your videos are ready. News search couldn’t finish this time.');
      else if (news.status === 'rejected' && !videos.length) setError(controller.signal.aborted ? 'That search took a little too long. Try again or use a more specific topic.' : 'Search services are temporarily unavailable. Please try again.');
      else if (!articles.length && !videos.length) setError('No stories or videos matched this topic. Try a more specific search.');
    } finally {
      clearTimeout(timeout);
      if (current === generation.current) { setLoading(false); request.current = null; callbacks.current.onSearchState?.({ loading: false, query: topic, language, region }); }
    }
  }
  function cancel() {
    generation.current += 1; request.current?.abort(); request.current = null;
    setLoading(false); setError(''); callbacks.current.onSearchState?.({ loading: false, query: activeQuery, cancelled: true });
  }
  async function saveTopic() {
    const topic = query.trim();
    if (!topic || savingTag) return;
    if (!token) { setError('Sign in to save a topic.'); return; }
    if (tags.some(tag => tag.tagName?.toLocaleLowerCase() === topic.toLocaleLowerCase())) { setError('This topic is already saved.'); return; }
    if (tags.length >= 12) { setError('You can save up to 12 topics. Remove one to add another.'); return; }
    setSavingTag(true); setError('');
    try {
      await jsonRequest(`${API_URL}/tags`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId, tagName: topic }) });
      const data = await jsonRequest(`${API_URL}/tags`, { headers: { Authorization: `Bearer ${token}` } });
      setTags(Array.isArray(data) ? data : []);
    } catch (err) { setError(err.message || 'This topic could not be saved.'); }
    finally { setSavingTag(false); }
  }
  async function removeTopic(topic) {
    setError('');
    try {
      await jsonRequest(`${API_URL}/tags/${encodeURIComponent(topic)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setTags(previous => previous.filter(tag => tag.tagName !== topic));
    } catch (err) { setError(err.message || 'This topic could not be removed.'); }
  }
  return <div className="searchbar">
    <form onSubmit={search} className="searchbar-form" role="search" aria-label="Search stories and videos" aria-busy={loading}>
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a topic. Find stories + videos." aria-label="Search stories and videos by topic" dir="auto" className="searchbar-input" maxLength={120} />
      <button type="submit" disabled={query.trim().length < 2} className="searchbar-btn" aria-label="Search stories and videos"><SearchIcon style={{ fontSize: '1.15rem' }} /><span className="searchbar-submit-label">Search</span></button>
      <button type="button" onClick={saveTopic} disabled={!query.trim() || savingTag} className="addTag-btn">{savingTag ? 'Saving…' : 'Save topic'}</button>
    </form>
    <div className="searchbar-language-row"><label className="searchbar-language-picker"><span>News language</span><select aria-label="News language" value={languageChoice} onChange={event => { setLanguageChoice(event.target.value); setRegion(''); setError(''); }}>{NEWS_LANGUAGES.map(([code,label]) => <option key={code} value={code}>{label}</option>)}</select></label>{languageChoice === 'custom' && <input className="searchbar-language-code" aria-label="Custom BCP 47 language code" placeholder="e.g. he, fr-CA, sw" value={customLanguage} onChange={event => setCustomLanguage(event.target.value)} maxLength={60} autoComplete="off" spellCheck={false} />}<span className="searchbar-language-hint">Original publisher text · all scripts welcome</span></div>
    {localeMessage && <p className="searchbar-locale-message" role="status">{localeMessage}</p>}
    {loading && <PixelSearch query={activeQuery} onCancel={cancel} />}
    {tags.length > 0 && <div className="tag-container" aria-label="Saved topics">{tags.map(tag => <div key={tag._id || tag.tagName} className="tag"><button type="button" className="tag-text" onClick={() => search(null, tag.tagName)}>#{tag.tagName}</button><button type="button" className="tag-remove" onClick={() => removeTopic(tag.tagName)} title="Remove topic" aria-label={`Remove topic ${tag.tagName}`}>×</button></div>)}</div>}
    {error && <p className="searchbar-error" role="alert">{error}</p>}
  </div>;
}
