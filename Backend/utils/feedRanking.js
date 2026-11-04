const {canonicalLanguage,articleLocale}=require('./newsLocale');
const DEFAULT_PREFERENCES=Object.freeze({personalized:true,mode:'balanced',freshness:0.5,diversity:0.5,followedTopics:[],mutedTopics:[]});
const STOPWORDS=new Set('a an and are as at be been but by can for from had has have how i if in into is it its just me more my not of on or our out that the their them then there these they this to us was we were what when where which who why will with you your about after before between through over under news new latest article story stories video videos היום את של על עם זה זאת הוא היא הם גם או אל כל לא יש אין אני אנחנו אתם לכם שלנו יותר חדשות כתבה חדשותינו في من على عن إلى هذا هذه هو هي أن أو ما مع لا كان التي الذي'.split(' '));
const segmenter=new Intl.Segmenter(undefined,{granularity:'word'});
function tokens(value,limit=80){if(typeof value!=='string')return[];const found=new Set();for(const part of segmenter.segment(value.normalize('NFKC').toLocaleLowerCase())){const word=part.segment;if(part.isWordLike&&word.length>1&&!STOPWORDS.has(word)&&!/^\d+$/.test(word))found.add(word);if(found.size>=limit)break;}return[...found];}
function canonicalUrl(value){if(typeof value!=='string'||value.length>2048||/[\u0000-\u001f\u007f]/u.test(value))return'';try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return'';url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid','dclid','mc_cid','mc_eid','igshid','yclid','ref_src'].includes(key.toLowerCase()))url.searchParams.delete(key);url.searchParams.sort();return url.href;}catch{return'';}}
function normalizedTitle(value){return typeof value==='string'?value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu,' ').trim().slice(0,300):'';}
function contentText(item){return `${typeof item.title==='string'?item.title:''} ${typeof item.contentSnippet==='string'?item.contentSnippet:typeof item.description==='string'?item.description:''}`.slice(0,8000);}
function sourceFor(item){const source=item.sourceUrl||item.source?.url||item.source?.link||item.link||item.url;try{const host=new URL(source).hostname.toLowerCase().replace(/^www\./,'');if(host==='news.google.com'){const title=typeof item.title==='string'?item.title:'';const match=title.match(/\s[-–—]\s([^–—]+)$/u);return match?match[1].trim().toLocaleLowerCase():item.sourceTitle||host;}return host;}catch{return item.sourceTitle||'unknown';}}
function languageMatches(item,locale){if(!locale||locale.mode==='any')return true;const expected=locale.language;if(!expected)return true;const text=contentText(item);if(expected==='he')return /[\u0590-\u05ff]/u.test(text);if(['ar','fa','ur','ps','sd'].includes(expected))return /[\u0600-\u08ff]/u.test(text);const declared=articleLocale(item,locale).language;try{return new Intl.Locale(canonicalLanguage(declared)||expected).language===expected;}catch{return true;}}
function topicMatches(item,query){if(!query)return true;if(item.retrievalQuery===query)return true;const required=tokens(query,30);if(!required.length)return true;const words=new Set(tokens(contentText(item),300));return required.every(word=>words.has(word));}
function isHidden(item,context={}){const key=canonicalUrl(item.link||item.url);return Boolean(key&&(context.hiddenUrls||[]).includes(key))||(context.hiddenTitles||[]).includes(normalizedTitle(item.title));}
function overlap(words,interest){const terms=interest.tokens||tokens(interest.topic,20);return terms.length?terms.filter(word=>words.has(word)).length/Math.sqrt(terms.length):0;}
function rankArticles(items,context={},options={}){
 const preferences={...DEFAULT_PREFERENCES,...context.preferences};const now=Number.isFinite(options.now)?options.now:Date.now();
 const query=typeof options.query==='string'?options.query:'';const locale=options.locale;const requestedMode=options.modeOverride||preferences.mode;const chronological=!preferences.personalized||requestedMode==='fresh';
 const mode=chronological?'fresh':requestedMode;const diversity=chronological?0:mode==='discover'?Math.max(0.7,preferences.diversity):preferences.diversity;
 const muted=(preferences.mutedTopics||[]).map(topic=>tokens(topic,20)).filter(list=>list.length);const seen=new Set();const candidates=[];
 for(const item of Array.isArray(items)?items:[]){
  const key=canonicalUrl(item.link||item.url);if(!key||seen.has(key)||isHidden(item,context)||!topicMatches(item,query)||!languageMatches(item,locale))continue;
  const words=new Set(tokens(contentText(item),300));if(!query&&muted.some(list=>list.every(word=>words.has(word))))continue;
  const interests=Array.isArray(context.interests)?context.interests:[];let affinity=0;let best=null;let bestMatch=0;let following=false;
  for(const interest of interests){const match=overlap(words,interest);if(!match)continue;const contribution=match*interest.weight;affinity+=contribution;if(contribution>bestMatch){best=interest;bestMatch=contribution;}if(['followed','saved-topic','community'].includes(interest.source)&&interest.weight>0)following=true;}
  if(mode==='following'&&!query&&!following)continue;
  const parsed=Date.parse(item.pubDate||item.isoDate||item.createdAt||'');const timestamp=Number.isFinite(parsed)&&parsed<=now+300000?Math.min(parsed,now):0;const ageHours=timestamp?Math.max(0,(now-timestamp)/3600000):Infinity;const recent=Number.isFinite(ageHours)?Math.exp(-ageHours/36):0;
  const affinityScore=Math.max(-8,Math.min(8,affinity));const queryTerms=tokens(query,30);const queryScore=queryTerms.length?queryTerms.filter(word=>words.has(word)).length/queryTerms.length:0;
  const directFeedback=(context.moreUrls||[]).includes(key)?12:(context.lessUrls||[]).includes(key)?-16:0;
  const score=chronological?timestamp:directFeedback+queryScore*8+affinityScore*(mode==='discover'?0.45:1)+(1+5*preferences.freshness)*recent+((mode==='discover'&&!(context.openedUrls||[]).includes(key))?1:0);
  const reasons=[];if(query)reasons.push('Matches your search');if(!chronological&&directFeedback>0)reasons.push('Matches your feedback');if(!chronological&&bestMatch>0&&best?.reason)reasons.push(best.reason);if(ageHours<=36)reasons.push('Published recently');
  candidates.push({item,key,source:sourceFor(item),score,timestamp,reasons:[...new Set(reasons)].slice(0,3)});seen.add(key);
 }
 const ordered=[];const sources=new Map();
 if(chronological)return candidates.sort((a,b)=>b.timestamp-a.timestamp||a.key.localeCompare(b.key));
 const remaining=candidates.sort((a,b)=>b.score-a.score||b.timestamp-a.timestamp||a.key.localeCompare(b.key));
 while(remaining.length){let chosen=0;let high=-Infinity;for(let i=0;i<remaining.length;i++){const candidate=remaining[i];const penalty=(sources.get(candidate.source)||0)*diversity*2.2;const adjusted=candidate.score-penalty;if(adjusted>high){high=adjusted;chosen=i;}}
  const [record]=remaining.splice(chosen,1);if(ordered.length&&diversity>0&&!sources.has(record.source)&&chosen>0)record.reasons=[...new Set([...record.reasons,'A different source for variety'])].slice(0,3);ordered.push(record);sources.set(record.source,(sources.get(record.source)||0)+1);
 }
 return ordered;
}
module.exports={DEFAULT_PREFERENCES,tokens,canonicalUrl,normalizedTitle,sourceFor,topicMatches,languageMatches,isHidden,rankArticles};
