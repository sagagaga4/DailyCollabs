const RTL_LANGUAGES = new Set(['ar','he','fa','ur','ps','sd','ug','yi','dv','ku']);
// These are routing defaults, not a claim that every Google News edition is always available.
const EDITIONS = { en:['US','en-US','en'],he:['IL','he','he'],ar:['SA','ar','ar'],es:['ES','es','es'],fr:['FR','fr','fr'],de:['DE','de','de'],ru:['RU','ru','ru'],uk:['UA','uk','uk'],zh:['TW','zh-TW','zh-Hant'],ja:['JP','ja','ja'],ko:['KR','ko','ko'],hi:['IN','hi','hi'],pt:['BR','pt-BR','pt-419'],it:['IT','it','it'],nl:['NL','nl','nl'],pl:['PL','pl','pl'],tr:['TR','tr','tr'],sv:['SE','sv','sv'],da:['DK','da','da'],no:['NO','no','no'],fi:['FI','fi','fi'],cs:['CZ','cs','cs'],el:['GR','el','el'],ro:['RO','ro','ro'],hu:['HU','hu','hu'],sk:['SK','sk','sk'],bg:['BG','bg','bg'],sr:['RS','sr','sr'],sl:['SI','sl','sl'],lt:['LT','lt','lt'],lv:['LV','lv','lv'],et:['EE','et','et'],id:['ID','id','id'],ms:['MY','ms','ms'],vi:['VN','vi','vi'],th:['TH','th','th'],bn:['BD','bn','bn'],ta:['IN','ta','ta'],te:['IN','te','te'],mr:['IN','mr','mr'],ml:['IN','ml','ml'],kn:['IN','kn','kn'],gu:['IN','gu','gu'],ur:['PK','ur','ur'] };
function detectScriptLanguage(value) {
  const text = typeof value === 'string' ? value : '';
  const scripts = [['he',/[\u0590-\u05ff]/u],['fa',/[گپچژ]/u],['ur',/[ٹڈڑںھہ]/u],['ar',/[\u0600-\u06ff\u0750-\u077f]/u],['ja',/[\u3040-\u30ff]/u],['ko',/[\uac00-\ud7af\u1100-\u11ff]/u],['zh',/[\u3400-\u4dbf\u4e00-\u9fff]/u],['uk',/[іїєґІЇЄҐ]/u],['ru',/[\u0400-\u04ff]/u],['hi',/[\u0900-\u097f]/u],['bn',/[\u0980-\u09ff]/u],['ta',/[\u0b80-\u0bff]/u],['te',/[\u0c00-\u0c7f]/u],['th',/[\u0e00-\u0e7f]/u],['el',/[\u0370-\u03ff]/u],['hy',/[\u0530-\u058f]/u],['ka',/[\u10a0-\u10ff]/u]];
  return scripts.find(([,pattern]) => pattern.test(text))?.[0] || null;
}
function canonicalLanguage(value) {
  if (typeof value !== 'string' || value.length > 60 || !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value)) return null;
  try { return new Intl.Locale(value).baseName; } catch { return null; }
}
function resolveNewsLocale(query = '', language = 'auto', region = '') {
  const mode = language === 'auto' || language === 'any' || !language ? (language || 'auto') : 'explicit';
  const requested = mode === 'explicit' ? canonicalLanguage(language) : mode;
  if (!requested) { const error = new Error('Choose a valid BCP 47 language code, such as he, ar, or fr-CA.'); error.status = 400; throw error; }
  if (region && (typeof region !== 'string' || !/^[A-Za-z]{2}$/.test(region))) { const error = new Error('Use a two-letter region code.'); error.status = 400; throw error; }
  const tag = mode === 'explicit' ? requested : detectScriptLanguage(query) || 'en';
  const parsed = new Intl.Locale(tag);
  const base = parsed.language;
  const edition = EDITIONS[base];
  const gl = (region || (/^[A-Za-z]{2}$/.test(parsed.region || '') ? parsed.region : '') || (base === 'zh' && parsed.script === 'Hans' ? 'CN' : edition?.[0]) || 'US').toUpperCase();
  let hl = edition?.[1] || 'en-US'; let editionLanguage = edition?.[2] || 'en';
  if (base === 'en') hl = `en-${gl}`;
  if (base === 'pt' && gl === 'PT') { hl = 'pt-PT'; editionLanguage = 'pt-150'; }
  if (base === 'zh') { const traditional = parsed.script === 'Hant' || ['TW','HK'].includes(gl); hl = traditional ? 'zh-TW' : 'zh-CN'; editionLanguage = traditional ? 'zh-Hant' : 'zh-Hans'; }
  const configured = Boolean(edition);
  return { requested, mode, language: base, region: gl, tag: !region && parsed.region ? parsed.baseName : new Intl.Locale(parsed.baseName,{region:gl}).baseName,
    dir: parsed.script ? (['Arab','Hebr','Thaa','Nkoo','Adlm'].includes(parsed.script) ? 'rtl' : 'ltr') : RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr',
    hl, gl: configured ? gl : 'US', ceid: `${configured ? gl : 'US'}:${editionLanguage}`, editionConfigured: configured,
    message: !configured ? `No dedicated Google News edition is configured for ${parsed.baseName}. Worldwide results may include other languages.` : mode === 'any' ? 'Publisher text is shown in its original language.' : '' };
}
function googleNewsFeed(query, locale) {
  const parameters = new URLSearchParams({ ...(query ? {q:query} : {}), hl:locale.hl, gl:locale.gl, ceid:locale.ceid });
  return `https://news.google.com/rss${query ? '/search' : ''}?${parameters}`;
}
function articleLocale(item, fallback = {}) {
  const content = `${typeof item.title === 'string' ? item.title : ''} ${typeof item.contentSnippet === 'string' ? item.contentSnippet : ''}`.slice(0,1500);
  const detected = detectScriptLanguage(content);
  const source = canonicalLanguage(item.language || item.sourceLanguage || '');
  const declared = source || fallback.tag || fallback.language || 'und';
  const declaredBase = canonicalLanguage(declared) ? new Intl.Locale(declared).language : '';
  const sharedScript = (detected === 'ar' && ['ar','fa','ur','ps','sd'].includes(declaredBase)) || (detected === 'hi' && ['hi','mr','ne','sa'].includes(declaredBase)) || (detected === 'ru' && ['ru','uk','bg','sr','mk'].includes(declaredBase));
  const language = sharedScript ? declared : detected || declared;
  const firstLetter = [...content].find(character => /\p{Letter}/u.test(character));
  const dir = firstLetter && /[\u0590-\u08ff]/u.test(firstLetter) ? 'rtl' : 'ltr';
  return { language, lang:language, dir };
}
module.exports = { EDITIONS, canonicalLanguage, detectScriptLanguage, resolveNewsLocale, googleNewsFeed, articleLocale };
