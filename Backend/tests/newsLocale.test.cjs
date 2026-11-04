const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync}=require('node:child_process');
const {canonicalLanguage,resolveNewsLocale,googleNewsFeed,articleLocale}=require('../utils/newsLocale');

test('Hebrew/Arabic/Asian scripts route to original-language editions and RTL metadata',()=>{
 for(const [q,lang,region,dir] of [['טכנולוגיה','he','IL','rtl'],['تقنية','ar','SA','rtl'],['日本語ゲーム','ja','JP','ltr'],['한국어 뉴스','ko','KR','ltr'],['游戏','zh','TW','ltr'],['हिन्दी समाचार','hi','IN','ltr']]){
  const locale=resolveNewsLocale(q,'auto');assert.equal(locale.language,lang);assert.equal(locale.region,region);assert.equal(locale.dir,dir);
 }
 const url=new URL(googleNewsFeed('סקיירים',resolveNewsLocale('סקיירים','auto')));assert.equal(url.searchParams.get('q'),'סקיירים');assert.equal(url.searchParams.get('hl'),'he');assert.equal(url.searchParams.get('ceid'),'IL:he');
});
test('explicit languages, custom BCP47 codes, regions, and unsupported editions stay truthful',()=>{
 assert.equal(resolveNewsLocale('Redis','he').language,'he');assert.equal(resolveNewsLocale('Redis','es-419').tag,'es-419');assert.equal(resolveNewsLocale('Redis','fr-CA').ceid,'CA:fr');
 assert.equal(resolveNewsLocale('Redis','zh-Hans').ceid,'CN:zh-Hans');assert.equal(resolveNewsLocale('Redis','pt-PT').ceid,'PT:pt-150');
 const custom=resolveNewsLocale('habari','sw-KE');assert.equal(custom.tag,'sw-KE');assert.equal(custom.editionConfigured,false);assert.match(custom.message,/other languages/);
 assert.equal(resolveNewsLocale('טכנולוגיה','any').mode,'any');assert.equal(canonicalLanguage('iw-IL'),'he-IL');
 for(const bad of ['en<script>','en--US','en_US','en-a','../he','he\u0000'])assert.throws(()=>resolveNewsLocale('topic',bad));
 assert.throws(()=>resolveNewsLocale('topic','en','IL<script>'));
});
test('individual article direction follows actual text and does not force Hebrew text into English cards',()=>{
 const english=articleLocale({title:'Redis documentation',sourceLanguage:'en-US'},resolveNewsLocale('','he'));assert.equal(english.dir,'ltr');assert.equal(english.language,'en-US');
 const hebrew=articleLocale({title:'חדשות טכנולוגיה',contentSnippet:'חדשות בעברית'},resolveNewsLocale('','en'));assert.equal(hebrew.language,'he');assert.equal(hebrew.dir,'rtl');
 const arabic=articleLocale({title:'أخبار التقنية'},resolveNewsLocale());assert.equal(arabic.language,'ar');assert.equal(arabic.dir,'rtl');
});
test('Python AI and Node routing agree for common languages and custom tags',()=>{
 const cases=[['Redis','he'],['تقنية','auto'],['Redis','en'],['','fr-CA'],['','zh-Hans'],['','pt-PT'],['habari','sw-KE']];
 const script="import sys,json;sys.path.insert(0,sys.argv[1]);from news_locale import resolve_locale;print(json.dumps([resolve_locale(q,l) for q,l in json.loads(sys.argv[2])]))";
 const result=spawnSync('python3',['-B','-c',script,path.resolve(__dirname,'../../ai_service'),JSON.stringify(cases)],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});assert.equal(result.status,0,result.stderr);
 JSON.parse(result.stdout).forEach((value,index)=>{const expected=resolveNewsLocale(...cases[index]);for(const key of ['language','region','hl','gl','ceid','editionConfigured'])assert.equal(value[key],expected[key],`${cases[index]} ${key}`);});
});
test('RSS cache and AI requests separate identical topics by language and preserve feed language',async t=>{
 const axios=require('axios');const Parser=require('rss-parser');const calls=[];
 t.mock.method(axios,'post',async(url,body)=>{calls.push(body);return{data:{urls:[`https://example.test/${body.language}.xml`]}};});
 t.mock.method(Parser.prototype,'parseURL',async url=>({language:url.includes('/he.')?'he':'en',title:'Source',items:[{title:url.includes('/he.')?'חדשות Redis':'Redis news',link:url,pubDate:'2026-11-04'}]}));
 const helpers=require('../routers/rssRouter').localeHelpers;helpers.rawItemsCache.clear();
 const he=await helpers.getRawItems('Redis',resolveNewsLocale('Redis','he'));const en=await helpers.getRawItems('Redis',resolveNewsLocale('Redis','en'));await helpers.getRawItems('Redis',resolveNewsLocale('Redis','he'));
 assert.equal(calls.length,2);assert.equal(calls[0].language,'he');assert.equal(calls[0].region,'IL');assert.equal(he[0].sourceLanguage,'he');assert.equal(en[0].sourceLanguage,'en');assert.equal(helpers.rawItemsCache.size,2);helpers.rawItemsCache.clear();
});
test('live Hebrew publisher and Hebrew topic search preserve real Hebrew headlines',{skip:process.env.LIVE_NEWS_LOCALE!=='1',timeout:30000},async()=>{
 const Parser=require('rss-parser');const parser=new Parser({timeout:12000});
 const publisher=await parser.parseURL('https://www.ynet.co.il/Integration/StoryRss2.xml');assert.ok(publisher.items.some(item=>/[\u0590-\u05ff]/u.test(item.title)));
 const locale=resolveNewsLocale('טכנולוגיה','auto');const topic=await parser.parseURL(googleNewsFeed('טכנולוגיה',locale));assert.ok(topic.items.length);assert.ok(topic.items.some(item=>/[\u0590-\u05ff]/u.test(item.title)));
 console.log(JSON.stringify({publisher:publisher.title,publisherCount:publisher.items.length,topicCount:topic.items.length,sample:topic.items.slice(0,3).map(item=>item.title)}));
});
