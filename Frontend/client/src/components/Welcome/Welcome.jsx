import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Welcome.css';

function Arrow({ diagonal = false }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{diagonal ? <><path d="M6 18 18 6M6 6h12v12" /></> : <><path d="M4 12h15m-6-6 6 6-6 6" /></>}</svg>;
}

function FilmPlayer() {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const visibleRef = useRef(false);
  const reducedRef = useRef(false);
  const manualPauseRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = media.matches || document.documentElement.dataset.reducedMotion === 'true';
    setReduced(reducedRef.current);
    function syncPlayback() {
      if (visibleRef.current && !document.hidden && !reducedRef.current && !manualPauseRef.current) video.play().catch(() => setPlaying(false));
      else video.pause();
    }
    function motionChanged() {
      reducedRef.current = media.matches || document.documentElement.dataset.reducedMotion === 'true';
      setReduced(reducedRef.current);
      syncPlayback();
    }
    const preferenceObserver = new MutationObserver(motionChanged);
    preferenceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] });
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      visibleRef.current = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.25;
      syncPlayback();
    }, { threshold: [0, 0.25] }) : null;
    observer?.observe(containerRef.current);
    media.addEventListener('change', motionChanged);
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      observer?.disconnect();
      preferenceObserver.disconnect();
      media.removeEventListener('change', motionChanged);
      document.removeEventListener('visibilitychange', syncPlayback);
      video.pause();
    };
  }, []);

  async function toggle() {
    const video = videoRef.current;
    if (video.paused) {
      manualPauseRef.current = false;
      try { await video.play(); } catch { setFailed(true); }
    } else {
      manualPauseRef.current = true;
      video.pause();
    }
  }

  return <figure className="welcome-film" ref={containerRef}>
    <div className="welcome-film-topline"><span><i /> THE DAILYCOLLABS EXPERIENCE</span><span>00:10 / PRODUCT FILM</span></div>
    <div className="welcome-film-media"><video ref={videoRef} poster="/welcome/laptop-demo-poster.jpg" muted playsInline loop loading="lazy" preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)} aria-label="Ten-second product film showing the actual DailyCollabs application display on a rendered laptop."><source src="/welcome/laptop-demo.mp4" type="video/mp4" />Your browser cannot play this video. <a href="/welcome/laptop-demo.mp4">Download the product film.</a></video><button className="welcome-film-toggle" type="button" onClick={toggle} disabled={failed} aria-label={playing ? 'Pause product film' : 'Play product film'}><span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>{playing ? 'Pause film' : 'Play film'}</button></div>
    <figcaption><span>{failed ? <a href="/welcome/laptop-demo.mp4">Open the product film</a> : reduced ? 'Motion is paused to match your preference. Play whenever you like.' : 'A quick trip from a good discovery to a great conversation.'}</span><span>Rendered product demo · Silent loop</span></figcaption>
    <details className="welcome-film-description"><summary>Read the product film description</summary><p>A rendered laptop is shown on a dark, neutral stage. Its screen contains an unchanged capture of the actual DailyCollabs application, with the news and video feed, topic search, and community navigation. The camera moves gently around the laptop while short captions introduce the product. This silent product film uses a real app display rather than an invented interface.</p></details>
  </figure>;
}

const interests = [
  { code: '/g/', name: 'Technology', detail: 'Build. Break. Figure it out.', symbol: '⌘', color: 'cyan' },
  { code: '/v/', name: 'Gaming', detail: 'One more round, together.', symbol: '✚', color: 'green' },
  { code: '/mu/', name: 'Music', detail: 'Your next no-skip discovery.', symbol: '♫', color: 'peach' },
  { code: '/tv/', name: 'Film & television', detail: 'Stay for the end credits.', symbol: '▷', color: 'rose' },
  { code: '/ic/', name: 'Creative studio', detail: 'Make something only you can.', symbol: '✳', color: 'blue' },
];

export default function Welcome() {
  const member = Boolean(sessionStorage.getItem('token'));
  const joinPath = member ? '/' : '/register';
  const communityPath = member ? '/Communities' : '/register?next=%2FCommunities';
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'DailyCollabs — Your interests. One connected feed.';
    return () => { document.title = previousTitle; };
  }, []);

  return <div className="welcome-page">
    <a className="welcome-skip" href="#welcome-main">Skip to content</a>
    <header className="welcome-header"><div className="welcome-nav-wrap"><Link className="welcome-brand" to="/welcome" aria-label="DailyCollabs welcome"><span className="welcome-brand-symbol">d<span>c</span></span><span>DailyCollabs<span className="welcome-brand-period">.</span></span></Link><nav className={menu ? 'welcome-nav is-open' : 'welcome-nav'} aria-label="Welcome navigation"><a href="#welcome-product" onClick={() => setMenu(false)}>The experience</a><a href="#welcome-communities" onClick={() => setMenu(false)}>Find your people</a><a href="#welcome-how" onClick={() => setMenu(false)}>How it works</a></nav><div className="welcome-header-actions"><Link className="welcome-signin" to={member ? '/' : '/login'}>{member ? 'Your feed' : 'Sign in'}</Link><Link className="welcome-button welcome-button-small" to={joinPath}>{member ? 'Open DailyCollabs' : 'Join the collab'}<Arrow diagonal /></Link><button type="button" className="welcome-menu-toggle" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} onClick={() => setMenu(value => !value)}>{menu ? '×' : '☰'}</button></div></div></header>

    <main id="welcome-main" tabIndex={-1}>
      <section className="welcome-hero welcome-hero--product" aria-labelledby="welcome-title"><div className="welcome-hero-content"><div className="welcome-intro-pill"><span className="welcome-spark">✳</span> DISCOVER. DISCUSS. CONNECT. <span className="welcome-pill-line" /></div><h1 id="welcome-title">Your interests.<br /><span>One connected feed.</span></h1><p>News and videos in the languages you read.<br className="welcome-desktop-break" /> Communities for the things you care about.</p><div className="welcome-hero-actions"><Link className="welcome-button" to={joinPath}>{member ? 'Open your feed' : 'Create your account'}<Arrow diagonal /></Link><a className="welcome-secondary-link" href="#welcome-product"><span className="welcome-play-dot" aria-hidden="true">▶</span> Take a 10-second look</a></div><div className="welcome-hero-fineprint"><span /> Relevant content. Shared perspectives.</div></div><figure className="welcome-app-preview"><div className="welcome-preview-chrome"><span className="welcome-preview-dots" aria-hidden="true"><i /><i /><i /></span><span>DailyCollabs / Your daily feed</span><span aria-hidden="true">↗</span></div><a href="/welcome/app-preview.jpg" target="_blank" rel="noreferrer" aria-label="View the actual DailyCollabs app screenshot at full size"><img src="/welcome/app-preview.jpg" alt="Actual DailyCollabs app display with its news and video feed, topic search, and community navigation." fetchPriority="high" /></a><figcaption><span>One place for the things you care about.</span><span>ACTUAL APP DISPLAY</span></figcaption></figure><a className="welcome-scroll-hint" href="#welcome-product" aria-label="Explore the DailyCollabs experience"><span />SCROLL TO EXPLORE</a></section>

      <section className="welcome-product welcome-section" id="welcome-product" aria-labelledby="welcome-product-title"><div className="welcome-section-heading welcome-reveal"><div><p className="welcome-eyebrow">LESS NOISE. MORE SPARK.</p><h2 id="welcome-product-title">A good find is just<br />the <span>beginning.</span></h2></div><p>Follow a thought. Fall into a topic.<br />Turn “you have to see this” into<br />something worth sharing.</p></div><div className="welcome-reveal"><FilmPlayer /></div><div className="welcome-feature-rail welcome-reveal"><div><span>01 / DISCOVER</span><p>Your interests.<br /><strong>A fresh perspective.</strong></p></div><div><span>02 / CONNECT</span><p>Your kind of curious.<br /><strong>In one good place.</strong></p></div><div><span>03 / COLLABORATE</span><p>Your next idea.<br /><strong>Better with people.</strong></p></div><Link to={joinPath}>Make it your daily<Arrow diagonal /></Link></div></section>

      <section className="welcome-communities welcome-section" id="welcome-communities" aria-labelledby="welcome-community-title"><div className="welcome-section-heading welcome-reveal"><div><p className="welcome-eyebrow">THERE IS A BOARD FOR THAT</p><h2 id="welcome-community-title">Big interests.<br /><span>Your kind of people.</span></h2></div><Link className="welcome-text-link" to={communityPath}>Explore communities<Arrow diagonal /></Link></div><div className="welcome-interest-grid welcome-reveal">{interests.map((interest, index) => <Link to={communityPath} key={interest.code} className={`welcome-interest welcome-interest-${interest.color}`} style={{ '--interest-index': index }}><div className="welcome-interest-top"><span className="welcome-interest-symbol" aria-hidden="true">{interest.symbol}</span><span className="welcome-interest-code">{interest.code}</span><Arrow diagonal /></div><h3>{interest.name}</h3><p>{interest.detail}</p><span className="welcome-interest-bottom">Find your corner <span aria-hidden="true">↗</span></span></Link>)}</div><p className="welcome-community-note"><span aria-hidden="true">✳</span> Five demo boards to explore. An open invitation to build your own.</p></section>

      <section className="welcome-how welcome-section" id="welcome-how" aria-labelledby="welcome-how-title"><div className="welcome-how-copy welcome-reveal"><p className="welcome-eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</p><h2 id="welcome-how-title">From “that’s interesting”<br />to <span>“let’s make it happen.”</span></h2><p>A link becomes a conversation. A conversation becomes a connection. See where one good idea takes you.</p><Link className="welcome-button" to={joinPath}>{member ? 'Open your feed' : 'Start with your interests'}<Arrow diagonal /></Link></div><ol className="welcome-steps welcome-reveal"><li><span>01</span><div><h3>Follow a rabbit hole.</h3><p>Search a topic and find stories, videos, and perspectives that meet your curiosity.</p></div></li><li><span>02</span><div><h3>Find your corner.</h3><p>Join a community that feels like you, or create a new space for your own people.</p></div></li><li><span>03</span><div><h3>Pass the spark on.</h3><p>Save a good find, share it with a community, and add your voice to the conversation.</p></div></li></ol></section>

      <section className="welcome-final welcome-section welcome-reveal" aria-labelledby="welcome-final-title"><span className="welcome-final-star" aria-hidden="true">✳</span><p className="welcome-eyebrow">YOUR NEXT GOOD CONNECTION STARTS HERE</p><h2 id="welcome-final-title">Make room for<br /><span>better perspectives.</span></h2><Link className="welcome-button" to={joinPath}>{member ? 'Open DailyCollabs' : 'Join DailyCollabs'}<Arrow diagonal /></Link><p className="welcome-final-note">Bring an interest. Find a little belonging.</p></section>
    </main>
    <footer className="welcome-footer"><Link className="welcome-brand" to="/welcome"><span className="welcome-brand-symbol">d<span>c</span></span><span>DailyCollabs.</span></Link><span>Stay curious. Stay connected.</span><nav aria-label="Footer"><Link to={member ? '/' : '/login'}>{member ? 'Your feed' : 'Sign in'}</Link><Link to={communityPath}>Communities</Link><a href="#welcome-main">Back to top ↑</a></nav></footer>
  </div>;
}
