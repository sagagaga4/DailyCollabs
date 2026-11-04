const test=require('node:test');const assert=require('node:assert/strict');
const {tokens,canonicalUrl,rankArticles}=require('../utils/feedRanking');const {resolveNewsLocale}=require('../utils/newsLocale');const {createFeedSessions}=require('../utils/feedSessions');
const now=Date.parse('2026-11-04T12:00:00Z');
function item(id,title,age=0,source='publisher.example'){return{title,link:`https://${source}/${id}`,sourceUrl:`https://${source}`,pubDate:new Date(now-age*3600000).toISOString(),sourceLanguage:'en',contentSnippet:''};}
function context(overrides={}){return{preferences:{personalized:true,mode:'balanced',freshness:0.5,diversity:0,followedTopics:[],mutedTopics:[]},interests:[],hiddenUrls:[],hiddenTitles:[],...overrides};}
const options={now,locale:resolveNewsLocale('','any')};
test('Unicode topics tokenize without ASCII-only loss and tracking duplicates canonicalize safely',()=>{
 assert.ok(tokens('טכנולוגיה ותוכנה').includes('טכנולוגיה'));assert.ok(tokens('日本語のゲーム').length);assert.deepEqual(tokens('the news and video Redis'),['redis']);
 assert.equal(canonicalUrl('https://example.com/a?utm_source=x&b=2#fragment'),'https://example.com/a?b=2');assert.equal(canonicalUrl('javascript:alert(1)'),'');assert.equal(canonicalUrl('https://name:secret@example.com'), '');
 const first=item('a','Redis cache');const duplicate={...first,link:first.link+'?utm_source=two'};assert.equal(rankArticles([first,duplicate],context(),options).length,1);
});
test('explicit topic eligibility cannot be overridden by a strong unrelated profile',()=>{
 const profile=context({interests:[{topic:'cooking',tokens:['cooking'],weight:100,source:'followed',reason:'From a topic you follow'}]});
 const results=rankArticles([item('food','Cooking dinner'),item('redis','Redis cache latency')],profile,{...options,query:'Redis'});assert.deepEqual(results.map(r=>r.item.title),['Redis cache latency']);assert.ok(results[0].reasons.includes('Matches your search'));
});
test('Hebrew search preserves relevant Unicode provider results while excluding English-language candidates',()=>{
 const he={...item('he','אינטל רוכשת חברת תוכנה'),sourceLanguage:'he',retrievalQuery:'טכנולוגיה'};const en={...item('en','Technology news'),retrievalQuery:'טכנולוגיה'};
 const result=rankArticles([he,en],context(),{now,query:'טכנולוגיה',locale:resolveNewsLocale('טכנולוגיה','auto')});assert.equal(result.length,1);assert.equal(result[0].item.title,he.title);
});
test('hide is a hard exclusion, muting applies to For you, and an explicit search can override only muting',()=>{
 const story=item('redis','Redis patterns');const profile=context({preferences:{personalized:true,mode:'balanced',freshness:.5,diversity:0,mutedTopics:['Redis']}});
 assert.equal(rankArticles([story],profile,options).length,0);assert.equal(rankArticles([story],profile,{...options,query:'Redis'}).length,1);
 profile.hiddenUrls=[story.link];assert.equal(rankArticles([story],profile,{...options,query:'Redis'}).length,0);
});
test('personalization off and Latest mode use deterministic UTC chronology despite affinity',()=>{
 const old=item('old','Redis guide',24);const newer=item('new','Fresh general story',1);const invalid={...item('invalid','Undated story'),pubDate:'not-a-date'};
 const profile=context({preferences:{personalized:false,mode:'discover',freshness:0,diversity:1},interests:[{topic:'redis',tokens:['redis'],weight:100,source:'followed'}]});
 assert.deepEqual(rankArticles([old,invalid,newer],profile,options).map(r=>r.item.title),[newer.title,old.title,invalid.title]);
 profile.preferences.personalized=true;assert.equal(rankArticles([old,newer],profile,{...options,modeOverride:'fresh'})[0].item.title,newer.title);
 const future={...item('future','Future date'),pubDate:'2099-01-01T00:00:00Z'};assert.ok(rankArticles([future],profile,options)[0].score<20);assert.ok(!rankArticles([future],profile,options)[0].reasons.includes('Published recently'));
});
test('source-diversity control reduces repeated publisher runs without fabricated popularity',()=>{
 const input=[item('a1','First'),item('a2','Second'),item('b1','Third',1,'another.example')];
 const familiar=context();const broad=context({preferences:{personalized:true,mode:'balanced',freshness:.5,diversity:1}});
 assert.equal(rankArticles(input,familiar,options)[1].source,'publisher.example');assert.equal(rankArticles(input,broad,options)[1].source,'another.example');
 assert.ok(rankArticles(input,broad,options).every(r=>r.reasons.every(reason=>!reason.includes('Trending'))));
});
test('explicit more/less feedback outweighs generic saved-story affinity and following mode respects chosen interests',()=>{
 const a=item('a','Redis cache');const b=item('b','Redis database');const profile=context({moreUrls:[b.link],lessUrls:[a.link],interests:[{topic:'redis',tokens:['redis'],weight:5,source:'bookmark',reason:'Related to your saved stories'}]});
 const result=rankArticles([a,b],profile,options);assert.equal(result[0].key,b.link);assert.ok(result[0].reasons.includes('Matches your feedback'));
 const followed=context({preferences:{personalized:true,mode:'following',freshness:.5,diversity:0},interests:[{topic:'redis',tokens:['redis'],weight:10,source:'followed',reason:'From a topic you follow'}]});assert.equal(rankArticles([a,item('c','Cooking food')],followed,options).length,1);
});
test('ranking snapshots freeze ordering and remain scoped to account, topic, and lifetime',()=>{
 let clock=0;const sessions=createFeedSessions({now:()=>clock,ttl:100,max:3});const records=[{key:'first'},{key:'second'}];const snapshot=sessions.create('a','Redis-he',records,{snapshotAt:'2026-11-04'});
 assert.deepEqual(sessions.get(snapshot.id,'a','Redis-he').records,records);assert.equal(sessions.get(snapshot.id,'b','Redis-he'),null);assert.equal(sessions.get(snapshot.id,'a','Redis-en'),null);clock=101;assert.equal(sessions.get(snapshot.id,'a','Redis-he'),null);
});
