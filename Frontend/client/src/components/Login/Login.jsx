import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_URL } from '../../config';
import './Login.css';

function safeNext(value) { return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/'; }

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const registerUrl = next === '/' ? '/register' : `/register?next=${encodeURIComponent(next)}`;
  async function handleLogin(event) {
    event.preventDefault();
    if (pending) return;
    setError(''); setPending(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim(), password }) });
      const data = await response.json();
      if (!response.ok || !data.token) throw new Error(data.error || 'Your username or password didn’t match. Please try again.');
      sessionStorage.setItem('token', data.token);
      window.location.assign(next);
    } catch (err) { setError(err instanceof TypeError ? 'We couldn’t reach DailyCollabs. Please try again.' : err.message); }
    finally { setPending(false); }
  }
  return <main className="auth-page">
    <div className="auth-topbar"><Link to="/login" className="auth-brand"><span className="auth-brand-mark">d<span>c</span></span>DailyCollabs</Link><Link className="auth-control-link" to="/Agents">Mission control <span>↗</span></Link></div>
    <div className="auth-layout">
      <section className="auth-story"><span className="auth-eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span><h1>Your world. <br />Your people. <br /><span>Your daily collabs.</span></h1><p>Fresh perspectives, shared interests, and conversations worth coming back to.</p><div className="auth-interest-list"><span><i>⌘</i> Technology</span><span><i>♫</i> Music</span><span><i>▷</i> Film & video</span><span><i>✳</i> Creativity</span></div><div className="auth-story-footer"><span className="auth-story-star">✳</span><p>Find what moves you.<br /><strong>Then find who shares it.</strong></p></div></section>
      <section className="auth-panel" aria-labelledby="login-title"><span className="auth-panel-eyebrow">GOOD TO SEE YOU AGAIN</span><h2 id="login-title">Welcome back<span>.</span></h2><p className="auth-panel-description">Sign in and pick up where you left off.</p>
        {params.get('registered') === '1' && <p className="auth-feedback success" role="status">Your account is ready. Sign in to get started.</p>}
        <form className="auth-form" onSubmit={handleLogin} aria-busy={pending}>
          <label htmlFor="login-username">Username<input id="login-username" name="username" type="text" autoComplete="username" placeholder="Your username" value={username} onChange={event => setUsername(event.target.value)} required maxLength={60} disabled={pending} /></label>
          <label htmlFor="login-password">Password<input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={event => setPassword(event.target.value)} required disabled={pending} /></label>
          {error && <p className="auth-feedback error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}<span aria-hidden="true">↗</span></button>
        </form><p className="auth-switch">New around here? <Link to={registerUrl}>Create an account</Link></p><div className="auth-panel-footer"><span /> A space for curious minds.</div>
      </section>
    </div>
    <footer className="auth-bottom"><span>DailyCollabs · Stay curious. Stay connected.</span><span>Ideas travel better together.</span></footer>
  </main>;
}
