"""Language routing for original-language news feeds; no translation is performed."""
import re
from urllib.parse import urlencode

EDITIONS = {
    'en': ('US', 'en-US', 'en'), 'he': ('IL', 'he', 'he'), 'ar': ('SA', 'ar', 'ar'),
    'es': ('ES', 'es', 'es'), 'fr': ('FR', 'fr', 'fr'), 'de': ('DE', 'de', 'de'),
    'ru': ('RU', 'ru', 'ru'), 'uk': ('UA', 'uk', 'uk'), 'zh': ('TW', 'zh-TW', 'zh-Hant'),
    'ja': ('JP', 'ja', 'ja'), 'ko': ('KR', 'ko', 'ko'), 'hi': ('IN', 'hi', 'hi'),
    'pt': ('BR', 'pt-BR', 'pt-419'), 'it': ('IT', 'it', 'it'), 'nl': ('NL', 'nl', 'nl'),
    'pl': ('PL', 'pl', 'pl'), 'tr': ('TR', 'tr', 'tr'), 'sv': ('SE', 'sv', 'sv'),
    'da': ('DK', 'da', 'da'), 'no': ('NO', 'no', 'no'), 'fi': ('FI', 'fi', 'fi'),
    'cs': ('CZ', 'cs', 'cs'), 'el': ('GR', 'el', 'el'), 'ro': ('RO', 'ro', 'ro'),
    'hu': ('HU', 'hu', 'hu'), 'sk': ('SK', 'sk', 'sk'), 'bg': ('BG', 'bg', 'bg'),
    'sr': ('RS', 'sr', 'sr'), 'sl': ('SI', 'sl', 'sl'), 'lt': ('LT', 'lt', 'lt'),
    'lv': ('LV', 'lv', 'lv'), 'et': ('EE', 'et', 'et'), 'id': ('ID', 'id', 'id'),
    'ms': ('MY', 'ms', 'ms'), 'vi': ('VN', 'vi', 'vi'), 'th': ('TH', 'th', 'th'),
    'bn': ('BD', 'bn', 'bn'), 'ta': ('IN', 'ta', 'ta'), 'te': ('IN', 'te', 'te'),
    'mr': ('IN', 'mr', 'mr'), 'ml': ('IN', 'ml', 'ml'), 'kn': ('IN', 'kn', 'kn'),
    'gu': ('IN', 'gu', 'gu'), 'ur': ('PK', 'ur', 'ur'),
}
SCRIPTS = [('he', r'[\u0590-\u05ff]'), ('fa', r'[گپچژ]'), ('ur', r'[ٹڈڑںھہ]'),
           ('ar', r'[\u0600-\u06ff\u0750-\u077f]'), ('ja', r'[\u3040-\u30ff]'),
           ('ko', r'[\uac00-\ud7af\u1100-\u11ff]'), ('zh', r'[\u3400-\u4dbf\u4e00-\u9fff]'),
           ('uk', r'[іїєґІЇЄҐ]'), ('ru', r'[\u0400-\u04ff]'), ('hi', r'[\u0900-\u097f]'),
           ('bn', r'[\u0980-\u09ff]'), ('ta', r'[\u0b80-\u0bff]'), ('te', r'[\u0c00-\u0c7f]'),
           ('th', r'[\u0e00-\u0e7f]'), ('el', r'[\u0370-\u03ff]'), ('hy', r'[\u0530-\u058f]'), ('ka', r'[\u10a0-\u10ff]')]
HEBREW_FEEDS = ['https://www.ynet.co.il/Integration/StoryRss2.xml']

def resolve_locale(query='', language='auto', region=''):
    if not isinstance(language, str) or len(language) > 60:
        raise ValueError('Choose a valid BCP 47 language code.')
    mode = language if language in ('auto', 'any') else 'explicit'
    if mode == 'explicit' and not re.fullmatch(r'[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*', language):
        raise ValueError('Choose a valid BCP 47 language code.')
    if region and (not isinstance(region, str) or not re.fullmatch(r'[A-Za-z]{2}', region)):
        raise ValueError('Use a two-letter region code.')
    selected = language if mode == 'explicit' else next((lang for lang, pattern in SCRIPTS if re.search(pattern, query)), 'en')
    parts = selected.split('-'); base = parts[0].lower()
    if base == 'iw': base = 'he'
    if base == 'in': base = 'id'
    if base == 'ji': base = 'yi'
    explicit_region = next((part.upper() for part in parts[1:] if len(part) == 2 and part.isalpha()), '')
    edition = EDITIONS.get(base)
    country = (region or explicit_region or ('CN' if base == 'zh' and 'hans' in selected.lower() else edition[0] if edition else 'US')).upper()
    hl, suffix = (edition[1], edition[2]) if edition else ('en-US', 'en')
    if base == 'en': hl = f'en-{country}'
    if base == 'pt' and country == 'PT': hl, suffix = 'pt-PT', 'pt-150'
    if base == 'zh':
        traditional = 'hant' in selected.lower() or country in ('TW', 'HK')
        hl, suffix = ('zh-TW', 'zh-Hant') if traditional else ('zh-CN', 'zh-Hans')
    return {'requested': language, 'mode': mode, 'language': base, 'region': country,
            'hl': hl, 'gl': country if edition else 'US', 'ceid': f'{country if edition else "US"}:{suffix}',
            'editionConfigured': bool(edition)}

def google_news_feed(query, locale=None):
    locale = locale or resolve_locale(query)
    params = {'hl': locale['hl'], 'gl': locale['gl'], 'ceid': locale['ceid']}
    if query: params = {'q': query, **params}
    return f'https://news.google.com/rss{"/search" if query else ""}?{urlencode(params)}'
