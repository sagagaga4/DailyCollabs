import { NavLink } from 'react-router-dom';
import { useStoryComments } from '../Comments/useStoryComments';
import './Notifications.css';
export default function NotificationBell({ className = '' }) {
  const { unreadCount = 0 } = useStoryComments() || {};
  return <NavLink className={({ isActive }) => `dc-nav-link dc-notification-link${isActive ? ' is-active' : ''} ${className}`} to="/Notifications" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} title="Notifications"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M18 8a6 6 0 0 0-12 0v5l-2 3v1h16v-1l-2-3V8Z" /><path d="M9 20h6" strokeLinecap="round" /></svg><span>Notifications</span>{unreadCount > 0 && <b className="dc-notification-nav-count">{unreadCount > 99 ? '99+' : unreadCount}</b>}<i /></NavLink>;
}
