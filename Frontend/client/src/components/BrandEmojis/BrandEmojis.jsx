import { useState } from 'react';
import BRAND_EMOJIS from '../../lib/communityEmojis.json';
import './BrandEmojis.css';

// 25 original additions: code-native pixel, cosmic, and community expressions.
// The six original designs and stored reaction ids remain unchanged.
function normalizedName(name) {
  if (BRAND_EMOJIS.some(emoji => emoji.id === name)) return name;
  if (typeof name === 'string' && name.startsWith('dc_') && BRAND_EMOJIS.slice(0, 6).some(emoji => emoji.id === name.slice(3))) return name.slice(3);
  return null;
}

export function BrandEmoji({ name, className = '' }) {
  const emoji = BRAND_EMOJIS.find(item => item.id === normalizedName(name)) || BRAND_EMOJIS[0];
  return <svg className={`dc-emoji dc-emoji-${emoji.id} ${className}`} viewBox="0 0 32 32" role="img" aria-label={emoji.label} style={{ '--emoji-color': emoji.color }} fill="none">
    {emoji.id === 'spark' && <><path d="m16 2 3.2 10.8L30 16l-10.8 3.2L16 30l-3.2-10.8L2 16l10.8-3.2Z" fill="currentColor" /><path d="m16 10 1.3 4.7L22 16l-4.7 1.3L16 22l-1.3-4.7L10 16l4.7-1.3Z" fill="var(--surface,#101318)" /></>}
    {emoji.id === 'orbit' && <><circle cx="16" cy="16" r="6" fill="currentColor" /><ellipse cx="16" cy="16" rx="14" ry="6" stroke="currentColor" strokeWidth="2" transform="rotate(-35 16 16)" /><circle cx="25" cy="5" r="2.5" fill="currentColor" /></>}
    {emoji.id === 'pulse' && <><path d="M16 28S3 21 3 11C3 3 13 2 16 9c3-7 13-6 13 2 0 10-13 17-13 17Z" fill="currentColor" /><path d="M8 16h5l2-5 3 10 2-5h4" stroke="var(--surface,#101318)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>}
    {emoji.id === 'lens' && <><path d="M2 16S8 6 16 6s14 10 14 10-6 10-14 10S2 16 2 16Z" stroke="currentColor" strokeWidth="2" /><circle cx="16" cy="16" r="6" fill="currentColor" /><circle cx="18" cy="14" r="2" fill="var(--surface,#101318)" /></>}
    {emoji.id === 'bolt' && <><path d="m19 1-1 11h9L12 31l2-13H5Z" fill="currentColor" /><path d="m7 5 3 2M24 25l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
    {emoji.id === 'bloom' && <><path d="M16 4c6-7 12 2 7 7 9-1 10 10 2 11 3 8-7 13-11 6-5 7-14 0-10-7-9-4-4-14 4-11C6 2 15-3 16 4Z" fill="currentColor" /><circle cx="15" cy="15" r="4" fill="var(--surface,#101318)" /><path d="m13 15 1.5 1.5L18 13" stroke="currentColor" strokeWidth="1.5" /></>}
    {emoji.id === 'dc_grin' && <><path d="M8 3h16v3h4v22H4V6h4Z" fill="currentColor" /><path d="M9 12h3m8 0h3M9 19v3h14v-3" stroke="var(--surface,#101318)" strokeWidth="3" strokeLinejoin="miter" /><path d="M16 19v3" stroke="currentColor" strokeWidth="2" /></>}
    {emoji.id === 'dc_hype' && <><path d="m3 17 2-9 4 1-1 9m21-1-2-9-4 1 1 9M7 19l5 4v6h8v-6l5-4" stroke="currentColor" strokeWidth="3" strokeLinecap="square" /><path d="M11 8h10v11H11Z" fill="currentColor" /><path d="m13 12 2 2 4-3" stroke="var(--surface,#101318)" strokeWidth="2" /><path d="M16 1v3M5 2l3 3m19-3-3 3" stroke="currentColor" strokeWidth="2" /></>}
    {emoji.id === 'dc_cozy' && <><path d="M5 12h19v10a6 6 0 0 1-6 6h-7a6 6 0 0 1-6-6Z" fill="currentColor" /><path d="M24 15h3a4 4 0 0 1 0 8h-4M10 8c-4-4 4-4 0-7m7 7c-4-4 4-4 0-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M10 19h3m4 0h3" stroke="var(--surface,#101318)" strokeWidth="2" /></>}
    {emoji.id === 'dc_lurk' && <><path d="m16 2 7 7 6 18H3L9 9Z" fill="currentColor" /><path d="M8 15h16v8H8Z" fill="var(--surface,#101318)" /><path d="M10 18h4m4 0h4" stroke="currentColor" strokeWidth="2" /><path d="m5 30 3-3m19 3-3-3" stroke="currentColor" strokeWidth="2" /></>}
    {emoji.id === 'dc_gg' && <><path d="M8 4h16v11a8 8 0 0 1-16 0ZM8 7H3v6l6 4m15-10h5v6l-6 4M16 23v5m-7 1h14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="m16 7 2 4 4 .5-3 3 .7 4-3.7-2-3.7 2 .7-4-3-3 4-.5Z" fill="currentColor" /></>}
    {emoji.id === 'dc_brain' && <><path d="M15 6C9-1 2 8 6 12c-7 4-2 14 4 12 2 8 7 5 6 0m1-18c6-7 13 2 9 6 7 4 2 14-4 12-2 8-7 5-6 0V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M9 10v6h4m10-6v6h-4M9 22h4m6 0h4" stroke="currentColor" strokeWidth="2" /><circle cx="13" cy="16" r="2" fill="currentColor" /><circle cx="19" cy="22" r="2" fill="currentColor" /></>}
    {emoji.id === 'dc_rocket' && <><path d="M12 12C17 4 25 2 30 2c0 7-3 14-11 18l-7-8Z" fill="currentColor" /><circle cx="23" cy="9" r="3" fill="var(--surface,#101318)" /><path d="m12 12-7 1-3 7 10-2m7 2-1 9-7 2 2-10M8 24l-5 5m4-9-5 5m10 0-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
    {emoji.id === 'dc_comet' && <><path d="m4 4 15 8M2 11l13 5M9 2l14 10M2 18l12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="22" cy="21" r="9" fill="currentColor" /><path d="m18 20 2 2 5-4" stroke="var(--surface,#101318)" strokeWidth="2" /><circle cx="26" cy="25" r="1.5" fill="var(--surface,#101318)" /></>}
    {emoji.id === 'dc_glitch' && <><path d="M6 4h19v6h4v5h-4v9H9v4H4V14h4V9H6Z" fill="currentColor" /><path d="M9 12h5v4H9m10-2h5v4h-5M11 22h9" stroke="var(--surface,#101318)" strokeWidth="2" /><path d="M2 7h7m15 21h6M1 22h5m20-2h5" stroke="currentColor" strokeWidth="2" /></>}
    {emoji.id === 'dc_wow' && <><circle cx="16" cy="17" r="12" fill="currentColor" /><path d="M10 11v5m12-5v5" stroke="var(--surface,#101318)" strokeWidth="3" strokeLinecap="round" /><ellipse cx="16" cy="23" rx="3" ry="4" fill="var(--surface,#101318)" /><path d="m5 2 2 4m20-4-2 4M16 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
    {emoji.id === 'dc_sideeye' && <><path d="M4 8h24v19H4Z" stroke="currentColor" strokeWidth="2" /><path d="M7 13h8v8H7Zm12 0h7v8h-7Z" fill="currentColor" /><path d="M12 14v6m11-6v6M17 25h6" stroke="var(--surface,#101318)" strokeWidth="2" /><path d="m7 5 8 2m5 0 7-3" stroke="currentColor" strokeWidth="2" /></>}
    {emoji.id === 'dc_sus' && <><path d="m16 2 13 8-3 17H7L3 10Z" fill="currentColor" /><path d="m6 13 10-3 10 3-4 7H10Z" fill="var(--surface,#101318)" /><path d="m9 14 5 2m4 0 5-2M13 24h6" stroke="currentColor" strokeWidth="2" /></>}
    {emoji.id === 'dc_salute' && <><path d="M5 11h20v18H5ZM16 5V2m-3 0h6" stroke="currentColor" strokeWidth="2" /><path d="M8 15h5v4H8m11-4h3v4h-3M10 24h10" stroke="currentColor" strokeWidth="2" /><path d="m22 11 5-8 3 2-5 11" fill="currentColor" /><path d="M5 7h16" stroke="currentColor" strokeWidth="3" /></>}
    {emoji.id === 'dc_love' && <><path d="M3 7h4V3h7v4h4V3h7v4h4v12h-4v4h-4v4h-5v4h-4v-4H8v-4H4v-4H1V7Z" fill="currentColor" /><path d="M8 12v5m12-3h5m-13 8h8" stroke="var(--surface,#101318)" strokeWidth="2" /><path d="m3 28 2 2m24-2-2 2" stroke="currentColor" strokeWidth="2" /></>}
    {emoji.id === 'dc_chill' && <><path d="M5 18v-4a11 11 0 0 1 22 0v4" stroke="currentColor" strokeWidth="3" /><rect x="2" y="15" width="6" height="11" rx="2" fill="currentColor" /><rect x="24" y="15" width="6" height="11" rx="2" fill="currentColor" /><path d="m10 15 3 2m9-2-3 2m-7 6c3 4 5 4 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
    {emoji.id === 'dc_focus' && <><path d="M2 11V3h8m12 0h8v8m0 10v8h-8m-12 0H2v-8" stroke="currentColor" strokeWidth="2" /><path d="M7 10h18v13H7Z" fill="currentColor" /><path d="M10 14h4m4 0h4m-9 5h6" stroke="var(--surface,#101318)" strokeWidth="2" /><path d="M16 1v5m0 20v5M1 16h5m20 0h5" stroke="currentColor" strokeWidth="2" /></>}
    {emoji.id === 'dc_chef' && <><path d="M8 16C-1 14 3 3 10 7c1-9 13-8 13 0 8-4 12 7 3 9v5H8Z" fill="currentColor" /><path d="M8 25h18v4H8Z" fill="currentColor" /><path d="M12 13v5m5-7v7m5-5v5" stroke="var(--surface,#101318)" strokeWidth="2" /><path d="m1 25 2-2 2 2-2 2Z" fill="currentColor" /></>}
    {emoji.id === 'dc_based' && <><path d="M10 14 17 3h5v8h7v16H10ZM3 14h5v13H3Z" fill="currentColor" /><path d="M17 15h8m-8 5h8" stroke="var(--surface,#101318)" strokeWidth="2" /><path d="M5 31h22" stroke="currentColor" strokeWidth="2" /></>}
    {emoji.id === 'dc_oof' && <><path d="M5 5h22v21H5Z" fill="currentColor" /><path d="m9 11 5 5m0-5-5 5m9-5 5 5m0-5-5 5M11 22l4-2 6 2" stroke="var(--surface,#101318)" strokeWidth="2" /><path d="M2 29h9m4 0h6m4 0h5" stroke="currentColor" strokeWidth="2" /></>}
    {emoji.id === 'dc_peek' && <><path d="M4 29V9h24v20M1 29h30" stroke="currentColor" strokeWidth="2" /><path d="M8 20v-7a8 8 0 0 1 16 0v7" fill="currentColor" /><path d="M10 12h4v5h-4m8-5h4v5h-4" stroke="var(--surface,#101318)" strokeWidth="2" /><path d="M7 21v5m4-5v5m10-5v5m4-5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
    {emoji.id === 'dc_moon' && <><path d="M23 3C9-1-1 14 7 25c7 10 21 5 23-5C16 25 10 12 23 3Z" fill="currentColor" /><path d="m10 17 4 1m-3 4 4 1" stroke="var(--surface,#101318)" strokeWidth="2" strokeLinecap="round" /><path d="m25 3 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="currentColor" /></>}
    {emoji.id === 'dc_sun' && <><circle cx="16" cy="16" r="8" fill="currentColor" /><path d="M16 1v4m0 22v4M1 16h4m22 0h4M5 5l3 3m16 16 3 3M5 27l3-3M24 8l3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M12 13v3m8-3v3m-7 3q3 3 6 0" stroke="var(--surface,#101318)" strokeWidth="2" strokeLinecap="round" /></>}
    {emoji.id === 'dc_satellite' && <><path d="m11 4 17 17c-9 7-23-7-17-17Z" fill="currentColor" /><path d="m16 16 9-9m-4-5a10 10 0 0 1 9 9M22 7a5 5 0 0 1 3 3M12 23l-5 6m-5 1h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="25" cy="7" r="2" fill="currentColor" /></>}
    {emoji.id === 'dc_jam' && <><circle cx="14" cy="18" r="12" stroke="currentColor" strokeWidth="2" /><circle cx="14" cy="18" r="7" stroke="currentColor" strokeWidth="2" /><circle cx="14" cy="18" r="2" fill="currentColor" /><path d="M24 4v13m0-13 6-2v13" stroke="currentColor" strokeWidth="2" /><ellipse cx="21" cy="18" rx="4" ry="3" fill="currentColor" /><ellipse cx="27" cy="16" rx="4" ry="3" fill="currentColor" /></>}
    {emoji.id === 'dc_portal' && <><path d="M7 30V5l18-3v28Z" stroke="currentColor" strokeWidth="2" /><path d="M11 27V8l10-2v21Z" fill="currentColor" /><path d="m13 12 5 4-5 4m1-4h7" stroke="var(--surface,#101318)" strokeWidth="2" strokeLinejoin="round" /><path d="M2 30h28m-1-17 2 2m-2 5 2 2M1 12l2 2" stroke="currentColor" strokeWidth="2" /></>}
  </svg>;
}

export function EmojiText({ text = '' }) {
  return String(text).split(/(:[a-z][a-z0-9_]*:)/g).map((part, index) => {
    const name = part.startsWith(':') && part.endsWith(':') ? normalizedName(part.slice(1, -1)) : null;
    return name ? <BrandEmoji key={index} name={name} /> : part;
  });
}

export default function EmojiPicker({ onChoose, label = 'Choose a DailyCollabs emoji' }) {
  const [query, setQuery] = useState('');
  const filtered = BRAND_EMOJIS.filter(emoji => `${emoji.id} ${emoji.label} ${emoji.meaning}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="dc-emoji-picker" role="group" aria-label={label}><div className="dc-emoji-picker-heading"><span>EXPRESSIONS</span><span>{BRAND_EMOJIS.length} ORIGINALS</span></div><input type="search" className="dc-emoji-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find your expression…" aria-label="Search community emojis" /><div className="dc-emoji-grid">{filtered.map(emoji => <button key={emoji.id} type="button" title={`${emoji.label} · ${emoji.meaning} · :${emoji.id}:`} aria-label={`${emoji.label}: ${emoji.meaning}`} onClick={() => onChoose(emoji.id)}><BrandEmoji name={emoji.id} /></button>)}</div>{!filtered.length && <p className="dc-emoji-empty" role="status">No expressions match. Try another word.</p>}</div>;
}
