import { useEffect, useRef, useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import { applyAppearance, avatarInitials, DEFAULT_PREFERENCES, loadProfile, PROFILE_EVENT, readCachedProfile, saveProfile, THEME_PREVIEW_EVENT } from '../../lib/profile';
import { usePageActive } from '../Navigation/PageActivity';
import './Settings.css';

const THEMES = [
  { id: 'dark', name: 'Midnight', description: 'Deep focus, clear contrast', colors: ['#090b0e', '#171c23', '#58d5eb'] },
  { id: 'dim', name: 'Dim', description: 'A softer shade of dark', colors: ['#14202b', '#2a4053', '#74dcec'] },
  { id: 'light', name: 'Daylight', description: 'Bright and beautifully simple', colors: ['#f6f8fa', '#d7dfe7', '#087f96'] },
  { id: 'system', name: 'System', description: 'Follow your device', colors: ['#101318', '#e5eaf0', '#58d5eb'] },
];

function formFromProfile(profile) {
  return {
    fullname: profile?.fullname || '', username: profile?.username || '', bio: profile?.bio || '', avatar: profile?.avatar || '',
    preferences: { ...DEFAULT_PREFERENCES, ...(profile?.preferences || {}) },
  };
}

async function prepareAvatar(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const avatar = canvas.toDataURL('image/webp', 0.85);
    if (avatar.length > 680000) throw new Error('This image is too large. Please choose a smaller one.');
    return avatar;
  } finally { bitmap.close(); }
}

export default function Settings() {
  const pageActive = usePageActive();
  const pageActiveRef = useRef(pageActive); pageActiveRef.current = pageActive;
  const [profile, setProfile] = useState(readCachedProfile);
  const [form, setForm] = useState(() => formFromProfile(readCachedProfile()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [activeSection, setActiveSection] = useState('profile');
  const fileInput = useRef(null);
  const savedPreferences = useRef(profile?.preferences || DEFAULT_PREFERENCES);
  const mounted = useRef(true);
  const savingRequest = useRef(false);
  const formRef = useRef(form); formRef.current = form;
  const previewTheme = useRef(null);
  const themeDraftRevision = useRef(0);
  const previewDraftRevision = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const token = sessionStorage.getItem('token');
    mounted.current = true;
    const preview = event => {
      const theme = event.detail?.theme;
      if (sessionStorage.getItem('token') !== token || !['dark', 'dim', 'light', 'system'].includes(theme)) return;
      previewTheme.current = event.detail.pending === false ? null : theme;
      previewDraftRevision.current = themeDraftRevision.current;
      const preferences = { ...formRef.current.preferences, theme };
      formRef.current = { ...formRef.current, preferences };
      setForm(previous => ({ ...previous, preferences: { ...previous.preferences, theme } }));
      if (pageActiveRef.current) applyAppearance(preferences);
    };
    const sync = event => {
      const data = event.detail;
      if (!data || sessionStorage.getItem('token') !== token) return;
      const priorTheme = savedPreferences.current.theme;
      const pendingTheme = previewTheme.current;
      const draftTheme = formRef.current.preferences.theme;
      const newerThemeDraft = pendingTheme ? themeDraftRevision.current > previewDraftRevision.current : draftTheme !== priorTheme;
      savedPreferences.current = data.preferences; setProfile(data);
      if (previewTheme.current === data.preferences?.theme) previewTheme.current = null;
      const preferences = { ...formRef.current.preferences, theme: newerThemeDraft ? draftTheme : previewTheme.current || data.preferences.theme };
      formRef.current = { ...formRef.current, preferences };
      setForm(previous => ({ ...previous, preferences })); if (pageActiveRef.current) applyAppearance(preferences);
    };
    window.addEventListener(PROFILE_EVENT, sync);
    window.addEventListener(THEME_PREVIEW_EVENT, preview);
    loadProfile().then(data => {
      if (cancelled) return;
      setProfile(data);
      setForm(formFromProfile(data));
      savedPreferences.current = data?.preferences || DEFAULT_PREFERENCES;
    }).catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      mounted.current = false;
      window.removeEventListener(PROFILE_EVENT, sync); window.removeEventListener(THEME_PREVIEW_EVENT, preview);
      if (pageActiveRef.current) applyAppearance(sessionStorage.getItem('token') === token ? { ...savedPreferences.current, ...(previewTheme.current ? { theme: previewTheme.current } : {}) } : readCachedProfile()?.preferences);
    };
  }, []);

  useEffect(() => {
    // Keep the draft when this page is cached; preview it only while visible.
    if (pageActive) applyAppearance(formRef.current.preferences);
    else applyAppearance({ ...savedPreferences.current, ...(previewTheme.current ? { theme: previewTheme.current } : {}) });
  }, [pageActive]);

  const dirty = JSON.stringify(form) !== JSON.stringify(formFromProfile(profile));
  const updateField = (name, value) => {
    setForm(previous => ({ ...previous, [name]: value }));
    setSavedMessage('');
  };
  const updatePreference = (name, value) => {
    if (name === 'theme') themeDraftRevision.current += 1;
    const preferences = { ...form.preferences, [name]: value };
    formRef.current = { ...formRef.current, preferences };
    setForm(previous => ({ ...previous, preferences }));
    applyAppearance(preferences);
    setSavedMessage('');
  };

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setImageLoading(true);
    try {
      const avatar = await prepareAvatar(file);
      if (mounted.current) updateField('avatar', avatar);
    }
    catch (err) { if (mounted.current) setError(err.message || 'That image could not be opened. Try another image.'); }
    finally { if (mounted.current) setImageLoading(false); event.target.value = ''; }
  }

  async function save(event) {
    event.preventDefault();
    if (savingRequest.current) return;
    savingRequest.current = true;
    const token = sessionStorage.getItem('token');
    setSaving(true); setError(''); setSavedMessage('');
    try {
      const data = await saveProfile(form);
      if (sessionStorage.getItem('token') !== token) return;
      savedPreferences.current = data.preferences;
      if (mounted.current) {
        setProfile(data); setForm(formFromProfile(data));
        setSavedMessage('Your profile and preferences are saved.');
      }
    } catch (err) { if (mounted.current && sessionStorage.getItem('token') === token) setError(err.message); }
    finally { savingRequest.current = false; if (mounted.current) setSaving(false); }
  }

  function reset() {
    setForm(formFromProfile(profile));
    applyAppearance(profile?.preferences);
    setError(''); setSavedMessage('');
  }

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <div><span className="settings-eyebrow">YOUR SPACE, YOUR WAY</span><h1>Settings<span>.</span></h1><p>A little more you. Make DailyCollabs feel like home.</p></div>
        <span className="settings-private-note"><span /> Private to your account</span>
      </header>

      {loading ? <div className="settings-loading" role="status">Loading your profile…</div> : !profile ? (
        <div className="settings-notice" role="alert">{error || 'Log in to customize your profile.'}<button type="button" onClick={() => window.location.reload()}>Try again</button></div>
      ) : (
        <div className="settings-layout">
          <form className="settings-form" onSubmit={save} aria-busy={saving}>
            <fieldset className="settings-editable" disabled={saving}>
            <nav className="settings-tabs" aria-label="Settings sections">
              <button type="button" className={activeSection === 'profile' ? 'selected' : ''} aria-pressed={activeSection === 'profile'} onClick={() => setActiveSection('profile')}><PersonOutlineIcon /> Profile</button>
              <button type="button" className={activeSection === 'appearance' ? 'selected' : ''} aria-pressed={activeSection === 'appearance'} onClick={() => setActiveSection('appearance')}><PaletteOutlinedIcon /> Appearance</button>
            </nav>

            {activeSection === 'profile' ? <section className="settings-panel" aria-labelledby="profile-heading">
              <div className="settings-section-heading"><div><h2 id="profile-heading">Public profile</h2><p>Introduce yourself to your communities.</p></div><PersonOutlineIcon /></div>
              <div className="settings-avatar-row">
                <div className="settings-avatar large">{form.avatar ? <img src={form.avatar} alt="Your profile preview" /> : <span>{avatarInitials(form)}</span>}</div>
                <div><button type="button" className="settings-secondary" onClick={() => fileInput.current?.click()} disabled={imageLoading}><CameraAltOutlinedIcon />{imageLoading ? 'Preparing image…' : 'Change photo'}</button><p>PNG, JPEG, or WebP. We’ll resize it for you.</p>{form.avatar && <button type="button" className="settings-text-button" onClick={() => updateField('avatar', '')}>Remove photo</button>}</div>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} aria-label="Upload profile photo" hidden />
              </div>
              <div className="settings-fields-grid">
                <label>Display name<input name="fullname" value={form.fullname} onChange={e => updateField('fullname', e.target.value)} minLength={1} maxLength={60} required autoComplete="name" placeholder="Your name" /></label>
                <label>Username<div className="settings-input-prefix"><span>@</span><input name="username" value={form.username} onChange={e => updateField('username', e.target.value)} minLength={3} maxLength={30} required pattern="[a-zA-Z0-9_]{3,30}" autoComplete="username" placeholder="your_handle" aria-describedby="settings-username-hint" /></div><small id="settings-username-hint">3–30 letters, numbers, or underscores.</small></label>
              </div>
              <label className="settings-bio-label">Bio<textarea name="bio" value={form.bio} onChange={e => updateField('bio', e.target.value)} maxLength={240} rows={4} placeholder="What are you into? Share a little about yourself." aria-describedby="settings-bio-count" /><small id="settings-bio-count" className="settings-character-count">{form.bio.length} / 240</small></label>
              <div className="settings-account-info"><span>ACCOUNT EMAIL</span><strong>{profile.email}</strong><p>Your email stays private. Changing your username updates how you sign in.</p></div>
            </section> : <section className="settings-panel" aria-labelledby="appearance-heading">
              <div className="settings-section-heading"><div><h2 id="appearance-heading">Make yourself comfortable</h2><p>Preview your look. Save it when it feels right.</p></div><PaletteOutlinedIcon /></div>
              <fieldset className="settings-theme-fieldset"><legend>Color theme</legend><div className="settings-theme-grid">{THEMES.map(theme => (
                <label key={theme.id} className={`settings-theme-option ${form.preferences.theme === theme.id ? 'selected' : ''}`}>
                  <input type="radio" name="theme" value={theme.id} checked={form.preferences.theme === theme.id} onChange={() => updatePreference('theme', theme.id)} />
                  <div className="settings-theme-preview" style={{ background: theme.colors[0], '--preview-surface': theme.colors[1], '--preview-accent': theme.colors[2] }}><i /><div><b /><b /><b /></div><span>{form.preferences.theme === theme.id && <CheckIcon />}</span></div>
                  <strong>{theme.name}</strong><small>{theme.description}</small>
                </label>
              ))}</div></fieldset>
              <div className="settings-preference-row"><div><h3>Text size</h3><p>A comfortable reading size throughout the app.</p></div><div className="settings-segment" role="group" aria-label="Text size">{[['small', 'S'], ['default', 'M'], ['large', 'L']].map(([value, label]) => <button key={value} type="button" aria-label={`${value === 'default' ? 'Medium' : value} text`} aria-pressed={form.preferences.textSize === value} onClick={() => updatePreference('textSize', value)}>{label}</button>)}</div></div>
              <label className="settings-preference-row settings-toggle-row"><div><h3>Reduce motion</h3><p>Keep transitions and animations to a minimum.</p></div><input type="checkbox" checked={form.preferences.reducedMotion} onChange={e => updatePreference('reducedMotion', e.target.checked)} /><span className="settings-switch" aria-hidden="true" /></label>
              <p className="settings-preview-note"><TuneIcon /> Appearance changes are previewed instantly. Save to keep them across sessions.</p>
            </section>}
            </fieldset>

            {error && <div className="settings-feedback error" role="alert">{error}</div>}
            {savedMessage && <div className="settings-feedback success" role="status"><CheckIcon />{savedMessage}</div>}
            <footer className="settings-save-bar"><span>{dirty ? 'You have unsaved changes' : 'All changes saved'}</span><div><button type="button" className="settings-secondary" disabled={!dirty || saving} onClick={reset}>Reset</button><button type="submit" className="settings-primary" disabled={!dirty || saving || imageLoading}>{saving ? 'Saving…' : 'Save changes'}{!saving && <CheckIcon />}</button></div></footer>
          </form>

          <aside className="settings-profile-preview" aria-label="Live profile preview"><div className="settings-preview-title"><span>LIVE PREVIEW</span><span className="settings-preview-dot" /></div><div className="settings-preview-cover"><span>Make good connections.</span><i>✳</i></div><div className="settings-preview-body"><div className="settings-avatar preview">{form.avatar ? <img src={form.avatar} alt="Profile preview" /> : <span>{avatarInitials(form)}</span>}</div><span className="settings-member-badge">MEMBER</span><h2>{form.fullname || 'Your name'}</h2><p className="settings-preview-handle">@{form.username || 'your_handle'}</p><p className="settings-preview-bio">{form.bio || 'Curious minds find their people here.'}</p><div className="settings-preview-divider" /><span className="settings-preview-footer">Part of the DailyCollabs community</span></div><p className="settings-preview-caption">This is how other members see you.</p></aside>
        </div>
      )}
    </main>
  );
}
