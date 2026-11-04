import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../../config';
import '../Login/Login.css';
import './Register.css';

export default function Register() {
  const [form, setForm] = useState({ fullname: '', username: '', email: '', password: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const candidate = params.get('next');
  const next = candidate?.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\') ? candidate : '/';
  const loginUrl = next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  async function register(event) {
    event.preventDefault();
    if (pending) return;
    if (!/[A-Z]/.test(form.password) || !/[/#@^&*%]/.test(form.password)) { setError('Use at least one uppercase letter and one of these symbols: / # @ ^ & * %.'); return; }
    setError(''); setPending(true);
    try {
      const response = await fetch(`${API_URL}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, fullname: form.fullname.trim(), username: form.username.trim(), email: form.email.trim() }) });
      const text = await response.text();
      if (!response.ok) throw new Error(text || 'We couldn’t create your account. Please try again.');
      navigate(`${loginUrl}${loginUrl.includes('?') ? '&' : '?'}registered=1`, { replace: true });
    } catch (err) { setError(err instanceof TypeError ? 'We couldn’t reach DailyCollabs. Please try again.' : err.message); }
    finally { setPending(false); }
  }
  return <main className="auth-page auth-register">
    <div className="auth-topbar"><Link to={loginUrl} className="auth-brand"><span className="auth-brand-mark">d<span>c</span></span>DailyCollabs</Link><Link className="auth-control-link" to="/Agents">Mission control <span>↗</span></Link></div>
    <div className="auth-layout"><section className="auth-story"><span className="auth-eyebrow">THERE’S A COMMUNITY FOR YOUR CURIOSITY</span><h1>Make room <br />for your <br /><span>kind of people.</span></h1><p>Create your profile, find your interests, and make something of your everyday curiosity.</p><div className="auth-register-steps"><div><span>01</span><p><strong>Make it yours.</strong>A profile with a little personality.</p></div><div><span>02</span><p><strong>Find your corner.</strong>Communities built around what you love.</p></div><div><span>03</span><p><strong>Join the conversation.</strong>Share a thought, a story, or a video.</p></div></div></section>
      <section className="auth-panel" aria-labelledby="register-title"><span className="auth-panel-eyebrow">YOUR NEXT GOOD CONNECTION STARTS HERE</span><h2 id="register-title">Join the collab<span>.</span></h2><p className="auth-panel-description">A few details. A whole world to explore.</p><form className="auth-form" onSubmit={register} aria-busy={pending}>
        <label htmlFor="register-fullname">Display name<input id="register-fullname" name="fullname" autoComplete="name" placeholder="Your name" value={form.fullname} onChange={change} required maxLength={60} disabled={pending} /></label>
        <label htmlFor="register-username">Username<input id="register-username" name="username" autoComplete="username" placeholder="your_handle" value={form.username} onChange={change} required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]{3,30}" title="3–30 letters, numbers, or underscores" disabled={pending} /></label>
        <label htmlFor="register-email">Email<input id="register-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={change} required disabled={pending} /></label>
        <label htmlFor="register-password">Password<input id="register-password" name="password" type="password" autoComplete="new-password" placeholder="Create a password" value={form.password} onChange={change} required minLength={6} disabled={pending} /><small>6+ characters, an uppercase letter, and a symbol: # @ ^ & * % /</small></label>
        {error && <p className="auth-feedback error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}<span aria-hidden="true">↗</span></button>
      </form><p className="auth-switch">Already part of the collab? <Link to={loginUrl}>Sign in</Link></p></section>
    </div><footer className="auth-bottom"><span>DailyCollabs · Stay curious. Stay connected.</span><span>Ideas travel better together.</span></footer>
  </main>;
}
