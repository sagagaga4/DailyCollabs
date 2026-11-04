import { API_URL } from '../config';
import '../components/Settings/appearance.css';

export const DEFAULT_PREFERENCES = { theme: 'dark', textSize: 'default', reducedMotion: false };
export const PROFILE_EVENT = 'dailycollabs:profile';
let currentPreferences = { ...DEFAULT_PREFERENCES };
let mediaQuery;
let profileRevision = 0;
let latestProfile = null;

function currentUserId() {
  try {
    const payload = sessionStorage.getItem('token')?.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized)).id || null;
  } catch { return null; }
}

export function readCachedProfile() {
  const id = currentUserId();
  if (!id) return null;
  if (latestProfile?._id === id) return latestProfile;
  try {
    const profile = JSON.parse(localStorage.getItem(`dailycollabs:profile:${id}`) || 'null');
    return profile && profile._id === id ? profile : null;
  } catch { return null; }
}

function resolvedTheme() {
  if (currentPreferences.theme !== 'system') return currentPreferences.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyAppearance(preferences = DEFAULT_PREFERENCES) {
  currentPreferences = {
    theme: ['dark', 'dim', 'light', 'system'].includes(preferences?.theme) ? preferences.theme : 'dark',
    textSize: ['small', 'default', 'large'].includes(preferences?.textSize) ? preferences.textSize : 'default',
    reducedMotion: preferences?.reducedMotion === true,
  };
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme();
  root.dataset.reducedMotion = String(currentPreferences.reducedMotion);
  root.style.fontSize = `${{ small: 15, default: 16, large: 18 }[currentPreferences.textSize] || 16}px`;
  root.style.colorScheme = resolvedTheme() === 'light' ? 'light' : 'dark';
}

export function initializeAppearance() {
  applyAppearance(readCachedProfile()?.preferences);
  if (!mediaQuery) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (currentPreferences.theme === 'system') applyAppearance(currentPreferences);
    });
  }
}

export function cacheProfile(profile) {
  if (!profile || profile._id !== currentUserId()) return;
  profileRevision += 1;
  latestProfile = profile;
  // Cache belongs to the authenticated account; changing users cannot inherit a profile.
  try {
    localStorage.setItem(`dailycollabs:profile:${profile._id}`, JSON.stringify(profile));
    localStorage.setItem('currentUser', JSON.stringify(profile));
  } catch { /* A full browser cache must not prevent a successful server save. */ }
  applyAppearance(profile.preferences);
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: profile }));
}

export async function loadProfile() {
  const token = sessionStorage.getItem('token');
  if (!token) return null;
  const revision = profileRevision;
  const response = await fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || 'Your profile could not be loaded.');
  if (sessionStorage.getItem('token') !== token) return null;
  // A response requested before a successful save must not restore the old profile.
  if (revision !== profileRevision) return readCachedProfile() || data;
  cacheProfile(data);
  return data;
}

export function avatarInitials(profile) {
  const name = profile?.fullname || profile?.username || 'Member';
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}
