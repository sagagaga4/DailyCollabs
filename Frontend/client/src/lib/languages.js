export const NEWS_LANGUAGES = [
  ['auto','Auto · detect from topic'],['any','Any language'],['he','עברית · Hebrew'],['ar','العربية · Arabic'],['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['ru','Русский'],['uk','Українська'],['zh','中文'],['ja','日本語'],['ko','한국어'],['hi','हिन्दी'],['pt','Português'],['it','Italiano'],['tr','Türkçe'],['nl','Nederlands'],['pl','Polski'],['fa','فارسی'],['ur','اردو'],['bn','বাংলা'],['ta','தமிழ்'],['id','Bahasa Indonesia'],['vi','Tiếng Việt'],['th','ไทย'],['custom','Other language code…'],
];
export function canonicalLanguage(value) {
  if (typeof value !== 'string' || value.length > 60 || !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value)) return null;
  try { return new Intl.Locale(value).baseName; } catch { return null; }
}
export function validLanguageSelection(value) { return value === 'auto' || value === 'any' || canonicalLanguage(value); }
