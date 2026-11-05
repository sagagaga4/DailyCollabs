// routers/rssRouter.js
const express = require("express");
const Parser = require("rss-parser");
const ogs = require("open-graph-scraper");
const axios = require("axios");
const { extractFeedVideo, parseVideoUrl } = require("../utils/media");
const { getTopicImage } = require("../services/topicImageService");
const { resolveNewsLocale, googleNewsFeed, articleLocale } = require("../utils/newsLocale");
const auth = require("../middleware/authMiddleware");
const feedService = require("../services/feedService");
const { rankArticles, isHidden } = require("../utils/feedRanking");
const { createFeedSessions } = require("../utils/feedSessions");

const router = express.Router();
const optionalAuth = (req,res,next) => req.headers.authorization ? auth(req,res,next) : next();
router.use(optionalAuth);
const feedSessions = createFeedSessions();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5000";

// Configure parser to handle custom fields including media content
const parser = new Parser({
  timeout: 8000,
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['media:group', 'mediaGroup'],
      ['enclosure', 'enclosure']
    ]
  }
});

// --- Helper to safely fetch Open Graph images (cached) ---
const ogsCache = new Map();

async function safeOGS(url) {
  if (!validHttpUrl(url)) return null;
  if (ogsCache.has(url)) return ogsCache.get(url);
  let image = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {

    const { result } = await ogs({
      url,
      fetchOptions: { signal: controller.signal },
    });

    const img = result?.ogImage;
    image = publisherImage(Array.isArray(img) ? img[0]?.url : img?.url);
  } catch {
    image = null;
  } finally { clearTimeout(timeout); }
  ogsCache.set(url, image);
  return image;
}

// Google News RSS links are encoded redirects that hide the real article URL
// (and only expose a generic Google logo image). This decodes them to the real
// publisher URL so we can fetch the actual article image.
const googleNewsCache = new Map();

function isGoogleNews(url) {
  try { return new URL(url).hostname === "news.google.com"; } catch { return false; }
}

async function resolveGoogleNewsUrl(gUrl, locale = resolveNewsLocale()) {
  const cacheKey = `${locale.ceid}:${gUrl}`;
  if (googleNewsCache.has(cacheKey)) return googleNewsCache.get(cacheKey);
  let real = null;
  try {
    const id = gUrl.split("/articles/")[1].split("?")[0];
    const page = await axios.get(`https://news.google.com/rss/articles/${id}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 6000,
    });
    const html = page.data;
    const sig = html.match(/data-n-a-sg="([^"]+)"/);
    const ts = html.match(/data-n-a-ts="([^"]+)"/);
    if (sig && ts) {
      const payload = [
        "Fbv4je",
        JSON.stringify([
          "garturlreq",
          [
            ["X", "X", ["X", "X"], null, null, 1, 1, locale.ceid, null, 1, null,
              null, null, null, null, 0, 1],
            "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
          ],
          id,
          Number(ts[1]),
          sig[1],
        ]),
      ];
      const body = "f.req=" + encodeURIComponent(JSON.stringify([[payload]]));
      const r = await axios.post(
        "https://news.google.com/_/DotsSplashUi/data/batchexecute",
        body,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "Mozilla/5.0",
          },
          timeout: 6000,
        }
      );
      const m = r.data.match(/(https?:\/\/[^\\"]+)/);
      real = m ? m[1] : null;
    }
  } catch {
    real = null;
  }
  googleNewsCache.set(cacheKey, real);
  return real;
}

// Run an async mapper over items with a bounded concurrency.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function validHttpUrl(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}

function publisherImage(value, mime = '', medium = '') {
  const url = validHttpUrl(value);
  if (!url || medium === 'video' || (mime && !mime.toLowerCase().startsWith('image/')) || parseVideoUrl(url) || /\.(mp3|m4a|ogg|wav|mp4|webm)(?:$|\?)/i.test(url)) return null;
  return url;
}

// Preserve actual publisher artwork; video/audio enclosures are not images.
function extractImage(item) {
  const media = item['media:content'];
  for (const entry of (Array.isArray(media) ? media : media ? [media] : [])) {
    const attrs = entry?.$ || entry || {};
    const image = publisherImage(attrs.url, attrs.type, attrs.medium);
    if (image) return image;
  }
  const thumbnails = item['media:thumbnail'];
  for (const entry of (Array.isArray(thumbnails) ? thumbnails : thumbnails ? [thumbnails] : [])) {
    const image = publisherImage(entry?.$?.url || entry?.url);
    if (image) return image;
  }
  const enclosure = publisherImage(item.enclosure?.url, item.enclosure?.type);
  if (enclosure) return enclosure;
  const embedded = typeof item.content === 'string' ? item.content.match(/<img[^>]+src=["']([^"']+)["']/i) : null;
  return embedded ? publisherImage(embedded[1]) : null;
}

// Legacy GET retains an array response and uses the same eligibility/ranking rules.
router.get("/", async (req,res) => {
  try {
    const query=typeof req.query.query==='string'?req.query.query.trim().slice(0,200):'';
    const locale=resolveNewsLocale(query,req.query.language||'auto',req.query.region||'');
    const context=await feedService.getContext(req.user?.id);
    const snapshot=await createSnapshot(req.user?.id,query,locale,context,req.query.modeOverride||'');
    const articles=await enrichRecords(snapshot.records.slice(0,30),query,locale,context);
    res.json(articles);
  } catch(error) { res.status(error.status||500).json({error:error.status?error.message:'Failed to load feeds'}); }
});

// Cache the raw (un-resolved) feed items per query so pagination is fast and
// stable while the user scrolls (refreshed every few minutes).
const rawItemsCache = new Map();
const rawRequests = new Map();
const RAW_TTL_MS = 5 * 60 * 1000;

function getRawItems(query,locale=resolveNewsLocale(query)) {
  const key=JSON.stringify([query||'__default__',locale.requested,locale.tag,locale.ceid]);
  if(rawRequests.has(key))return rawRequests.get(key);
  const pending=fetchRawItems(query,locale).finally(()=>rawRequests.delete(key));
  rawRequests.set(key,pending);return pending;
}
async function fetchRawItems(query, locale = resolveNewsLocale(query)) {
  const key = JSON.stringify([query || "__default__", locale.requested, locale.tag, locale.ceid]);
  const cached = rawItemsCache.get(key);
  if (cached && Date.now() - cached.ts < RAW_TTL_MS) return cached.items;

  let feeds;
  try {
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/news-urls`, { query, language: locale.requested, region: locale.region }, { timeout: 10000 });
    feeds = Array.isArray(aiResponse.data.urls) ? aiResponse.data.urls : [];
  } catch {
    feeds = [googleNewsFeed(query, locale)];
    if (!query && locale.language === 'he') feeds.unshift('https://www.ynet.co.il/Integration/StoryRss2.xml');
  }
  feeds = feeds.filter(validHttpUrl).slice(0, 10);

  const batches = await mapWithConcurrency(feeds,4,async feedUrl => {
    try {
      const feed = await parser.parseURL(feedUrl);
      let trustedQuery='';
      try { const source=new URL(feedUrl); if(source.hostname==='news.google.com' && source.pathname.startsWith('/rss')) trustedQuery=source.searchParams.get('q')||''; } catch { /* URL was already validated. */ }
      return feed.items.slice(0,250).map(item => ({ ...item, retrievalQuery: trustedQuery, sourceLanguage: feed.language || locale.tag, sourceTitle: feed.title || '', sourceUrl: item.source?.url || feed.link || feedUrl }));
    } catch { return []; }
  });
  const rawItems = batches.flat();
  rawItems.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

  if (rawItemsCache.size >= 100) rawItemsCache.delete(rawItemsCache.keys().next().value);
  rawItemsCache.set(key, { items: rawItems, ts: Date.now() });
  return rawItems;
}

// Resolve a real article URL + image for a single raw feed item.
async function resolveItem(item, { topicImagePromise = null, locale = resolveNewsLocale() } = {}) {
  const video = extractFeedVideo(item);
  let image = extractImage(item);
  if (parseVideoUrl(image)) image = null;
  let link = validHttpUrl(item.link) || '#';
  let imageSource = image ? 'feed' : null;

  if (!image && isGoogleNews(item.link)) {
    const real = await resolveGoogleNewsUrl(item.link, locale);
    if (real) {
      link = validHttpUrl(real) || link;
      image = await safeOGS(link);
      if (image) imageSource = 'publisher';
    }
  } else if (!image && item.link) {
    image = await safeOGS(item.link);
    if (image) imageSource = 'publisher';
  }

  const topicImage = !image ? await (topicImagePromise || getTopicImage(item.title, locale)) : null;
  const artwork = image
    ? { image, imageSource, imageCredit: 'Publisher image', imagePage: validHttpUrl(link) || '', isTopicImage: false }
    : topicImage || { image: false, imageSource: null, imageCredit: '', imagePage: '', isTopicImage: false };

  return {
    title: item.title || "No title",
    ...articleLocale(item, locale),
    sourceTitle: item.sourceTitle || item.creator || "",
    link: link || "#",
    ...artwork,
    videoUrl: video?.url || null,
    pubDate: item.pubDate || new Date().toISOString(),
    description:
      item.contentSnippet || item.description || "No description available",
  };
}

function sessionKey(query,locale,modeOverride) { return JSON.stringify([query,locale.requested,locale.tag,locale.ceid,modeOverride||'']); }
async function createSnapshot(userId,query,locale,context,modeOverride='') {
  if(modeOverride && !['balanced','fresh','discover','following'].includes(modeOverride)) { const error=new Error('Choose a supported feed mode.');error.status=400;throw error; }
  const effectiveMode=modeOverride||context.preferences.mode;
  const personalized=context.preferences.personalized && effectiveMode!=='fresh';
  const retrieval=[query];
  if(!query && personalized)retrieval.push(...context.retrievalTopics.slice(0,2));
  const pools=await Promise.all(retrieval.map(topic=>getRawItems(topic,locale)));
  const now=Math.floor(Date.now()/60000)*60000;
  const candidates=pools.flatMap(pool=>pool.slice(0,250));
  const records=rankArticles(candidates,context,{query,locale,modeOverride,now}).slice(0,500);
  const metadata={algorithm:'weighted-relevance-v1',mode:!context.preferences.personalized?'fresh':modeOverride||context.preferences.mode,personalized:Boolean(personalized),snapshotAt:new Date(now).toISOString(),candidateCount:candidates.length,eligibleCount:records.length,signalsCount:context.signalsCount};
  return feedSessions.create(userId,sessionKey(query,locale,modeOverride),records,metadata);
}
async function enrichRecords(records,query,locale,context) {
  const topicImagePromise=query?getTopicImage(query,locale):null;
  const articles=await mapWithConcurrency(records,10,async record=>({...await resolveItem(record.item,{topicImagePromise,locale}),reasons:record.reasons}));
  return articles.filter(item=>!isHidden(item,context));
}
// Rank before pagination. A private snapshot keeps later pages in the same order.
router.post("/",async(req,res)=>{
 const rawQuery=req.body?.query??'';
 if(typeof rawQuery!=='string'||rawQuery.length>200||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(rawQuery))return res.status(400).json({error:'Use a valid text topic up to 200 characters.'});
 const query=rawQuery.normalize('NFKC').replace(/\s+/gu,' ').trim();
 const page=Math.max(1,Math.min(1000,parseInt(req.body?.page,10)||1));
 const pageSize=Math.min(30,Math.max(1,parseInt(req.body?.pageSize,10)||12));
 try {
  const locale=resolveNewsLocale(query,req.body?.language||'auto',req.body?.region||'');
  const modeOverride=req.body?.modeOverride||'';
  if(typeof modeOverride!=='string'||(modeOverride&&!['balanced','fresh','discover','following'].includes(modeOverride)))return res.status(400).json({error:'Choose a supported feed mode.'});
  const context=await feedService.getContext(req.user?.id);
  const key=sessionKey(query,locale,modeOverride);
  const requestedSession=req.body?.rankingSession;
  if(requestedSession && (typeof requestedSession!=='string'||requestedSession.length>60))return res.status(400).json({error:'Invalid feed snapshot.'});
  let snapshot=page>1?(requestedSession?feedSessions.get(requestedSession,req.user?.id,key):feedSessions.latest(req.user?.id,key)):null;
  if(page>1&&requestedSession&&!snapshot)return res.status(409).json({error:'This feed snapshot has expired or changed. Refresh the feed to continue.',code:'FEED_SNAPSHOT_EXPIRED'});
  if(!snapshot)snapshot=await createSnapshot(req.user?.id,query,locale,context,modeOverride);
  const start=(page-1)*pageSize;
  const articles=await enrichRecords(snapshot.records.slice(start,start+pageSize),query,locale,context);
  const hasMore=start+pageSize<snapshot.records.length;
  res.json({articles,page,pageSize,hasMore,locale,language:locale.language,region:locale.region,message:locale.message,rankingSession:snapshot.id,ranking:{...snapshot.metadata,session:snapshot.id}});
 } catch(error) { res.status(error.status||500).json({error:error.status?error.message:'Failed to load feeds'}); }
});

module.exports = router;
module.exports.imageHelpers = { extractImage, publisherImage, resolveItem };
module.exports.localeHelpers = { getRawItems, rawItemsCache };
module.exports.feedHelpers = { createSnapshot, sessionKey, feedSessions, enrichRecords };
