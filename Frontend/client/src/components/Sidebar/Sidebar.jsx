import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { applyAppearance, avatarInitials, loadProfile, PROFILE_EVENT, readCachedProfile } from '../../lib/profile';
import NotificationBell from '../Notifications/NotificationBell';
import ThemeToggle from './ThemeToggle';
import './Sidebar.css';

function Icon({ name }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h5v-6h4v6h5V9" /></>,
    communities: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2" /></>,
    posts: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    bookmarks: <path d="M6 3h12v18l-6-4-6 4z" />,
    comments: <><path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z"/><path d="M7 9h9M7 13h6"/></>,
    settings: <><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3z" /><circle cx="12" cy="12" r="3" /></>,
    agents: <><rect x="3" y="4" width="18" height="14" rx="3" /><path d="M8 21h8M12 18v3M7 13l3-3 3 2 4-5" /></>,
    logout: <><path d="M9 4H4v16h5M13 7l5 5-5 5M8 12h12" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const links = [
  ['/', 'Home', 'home'], ['/Communities', 'Communities', 'communities'], ['/Posts', 'Posts', 'posts'],
  ['/Bookmarked', 'Bookmarks', 'bookmarks'], ['/Channel', 'My channel', 'posts'], ['/Comments', 'My comments', 'comments'], ['/Settings', 'Settings', 'settings'], ['/Agents', 'Mission control', 'agents'],
];

export default function Sidebar() {
  const [profile, setProfile] = useState(readCachedProfile);
  useEffect(() => {
    let active = true;
    loadProfile().then(value => { if (active && value) setProfile(value); }).catch(() => {});
    const update = event => setProfile(event.detail);
    window.addEventListener(PROFILE_EVENT, update);
    return () => { active = false; window.removeEventListener(PROFILE_EVENT, update); };
  }, []);
  function logout() {
    sessionStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    applyAppearance();
    window.location.assign('/login');
  }
  return <aside className="dc-sidebar" aria-label="Main navigation">
    <a className="dc-skip-link" href="#main-content">Skip to content</a>
    <Link to="/" className="dc-brand" aria-label="DailyCollabs home"><span className="dc-brand-mark">d<span>c</span></span><span className="dc-brand-text">DailyCollabs<span>Find your people.</span></span></Link>
    <div className="dc-nav-label">YOUR DAILY SPACE</div>
    <nav className="dc-navigation" aria-label="Primary">
      {links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `dc-nav-link${isActive ? ' is-active' : ''}`} title={label}><Icon name={icon} /><span>{label}</span><i /></NavLink>)}
      <NotificationBell />
    </nav>
    <div className="dc-sidebar-note"><span className="dc-note-star">✳</span><strong>Stay curious.</strong><p>Good conversations start with something worth sharing.</p><Link to="/Communities">Explore communities <span>↗</span></Link></div>
    <div className="dc-sidebar-bottom">
      <Link to="/Settings" className="dc-profile" aria-label="Open profile settings"><span className="dc-profile-avatar">{profile?.avatar ? <img src={profile.avatar} alt="" /> : avatarInitials(profile)}</span><span className="dc-profile-text"><strong>{profile?.fullname || 'Your profile'}</strong><span>@{profile?.username || 'member'}</span></span><span className="dc-profile-more" aria-hidden="true">···</span></Link>
      <div className="dc-sidebar-actions"><ThemeToggle /><button className="dc-logout" type="button" onClick={logout} title="Sign out"><Icon name="logout" /><span>Sign out</span></button></div>
    </div>
  </aside>;
}
