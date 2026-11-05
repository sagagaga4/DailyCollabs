import { useEffect, useRef, useState } from 'react';
import { applyAppearance, PROFILE_SAVING_EVENT, readAppearance, readCachedProfile, saveProfile, THEME_PREVIEW_EVENT } from '../../lib/profile';

export default function ThemeToggle() {
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'light');
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  const pending = useRef(false);
  const otherSave = useRef(false);
  useEffect(() => {
    active.current = true;
    const observer = new MutationObserver(() => setLight(document.documentElement.dataset.theme === 'light'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const status = event => { if (event.detail?.token !== sessionStorage.getItem('token')) return; otherSave.current = event.detail.saving; setProfileSaving(event.detail.saving); };
    window.addEventListener(PROFILE_SAVING_EVENT, status);
    return () => { active.current = false; observer.disconnect(); window.removeEventListener(PROFILE_SAVING_EVENT, status); };
  }, []);
  async function toggle() {
    if (pending.current || otherSave.current) return;
    const token = sessionStorage.getItem('token');
    if (!token) return;
    const before = readAppearance();
    const savedBefore = readCachedProfile()?.preferences?.theme;
    const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    pending.current = true; setSaving(true); setError('');
    applyAppearance({ ...before, theme });
    window.dispatchEvent(new CustomEvent(THEME_PREVIEW_EVENT, { detail: { theme } }));
    try { await saveProfile({ preferences: { theme } }); }
    catch (failure) {
      if (sessionStorage.getItem('token') !== token) return;
      const latestTheme = readCachedProfile()?.preferences?.theme;
      const appearance = readAppearance();
      const savedTheme = appearance.theme !== theme ? appearance.theme : latestTheme && latestTheme !== savedBefore ? latestTheme : before.theme;
      applyAppearance({ ...appearance, theme: savedTheme });
      window.dispatchEvent(new CustomEvent(THEME_PREVIEW_EVENT, { detail: { theme: savedTheme, pending: false } }));
      if (active.current) setError(failure.message || 'Theme could not be saved. Try again.');
    } finally { pending.current = false; if (active.current) setSaving(false); }
  }
  const label = light ? 'Switch to dark mode' : 'Switch to light mode';
  return <div className="dc-theme-control"><button type="button" className="dc-theme-toggle" aria-label={label} title={saving ? 'Saving theme…' : label} aria-busy={saving} disabled={saving || profileSaving} onClick={toggle}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{light ? <path d="M20.6 13A8.7 8.7 0 0 1 11 3.4 8.8 8.8 0 1 0 20.6 13Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></>}</svg>
    <span className="dc-theme-label">{light ? 'Dark mode' : 'Light mode'}</span>
  </button>{error && <span className="dc-theme-error" role="alert">{error}</span>}</div>;
}
