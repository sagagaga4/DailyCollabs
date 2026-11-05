const crypto=require('node:crypto');
const mongoose=require('mongoose');
const User=require('../model/User');
const Bookmarked=require('../model/Bookmarked');
const Community=require('../model/Community');
const Tag=require('../model/Tags');
const FeedProfile=require('../model/FeedProfile');
const FeedSignal=require('../model/FeedSignal');
const {DEFAULT_PREFERENCES,tokens,canonicalUrl,normalizedTitle}=require('../utils/feedRanking');
const profileCache=new Map();const TTL=30000;const RETENTION=90*24*60*60*1000;
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function cleanText(value,limit,label){if(typeof value!=='string'||value.length>limit||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value))fail(`${label} must be plain text up to ${limit} characters.`);return value.normalize('NFKC').replace(/\s+/gu,' ').trim();}
function topicList(value,label){if(!Array.isArray(value)||value.length>30)fail(`${label} may contain up to 30 topics.`);const seen=new Set();return value.map(item=>cleanText(item,80,'Each topic')).filter(item=>{if(!item)fail('Topics cannot be empty.');const key=item.toLocaleLowerCase();if(seen.has(key))return false;seen.add(key);return true;});}
function validatePreferences(value){if(!value||typeof value!=='object'||Array.isArray(value))fail('Send a preferences object.');const allowed=['personalized','mode','freshness','diversity','followedTopics','mutedTopics'];if(Object.keys(value).some(key=>!allowed.includes(key)))fail('Unsupported feed preference.');const patch={};for(const[key,input]of Object.entries(value)){if(key==='personalized'){if(typeof input!=='boolean')fail('Personalization must be on or off.');patch[key]=input;}else if(key==='mode'){if(!['balanced','fresh','discover','following'].includes(input))fail('Choose a supported feed mode.');patch[key]=input;}else if(['freshness','diversity'].includes(key)){if(typeof input!=='number'||!Number.isFinite(input)||input<0||input>1)fail(`${key} must be between 0 and 1.`);patch[key]=input;}else patch[key]=topicList(input,key);}return patch;}
async function ensureUser(userId){if(!mongoose.isObjectIdOrHexString(userId)||!await User.exists({_id:userId}))fail('Please sign in again.',401);}
function invalidateProfile(userId){profileCache.delete(String(userId));}
async function profileDocument(userId){let record=await FeedProfile.findOne({userId}).lean();if(!record){try{record=(await FeedProfile.create({userId})).toObject();}catch(error){if(error.code!==11000)throw error;record=await FeedProfile.findOne({userId}).lean();}}return record;}
function preferencesOf(record){return{...DEFAULT_PREFERENCES,...record?.preferences,followedTopics:[...(record?.preferences?.followedTopics||[])],mutedTopics:[...(record?.preferences?.mutedTopics||[])]};}
const BOARD_TOPICS={g:['technology','programming','software'],v:['gaming','video games'],mu:['music'],tv:['film','television'],ic:['art','design','creativity']};
async function getContext(userId,{fresh=false}={}){
 if(!userId)return{preferences:{...DEFAULT_PREFERENCES,personalized:false},interests:[],hiddenUrls:[],hiddenTitles:[],openedUrls:[],moreUrls:[],lessUrls:[],signalsCount:0,retrievalTopics:[],recentSearches:[]};
 const id=String(userId);const cached=profileCache.get(id);if(!fresh&&cached&&Date.now()-cached.at<TTL)return cached.value;
 await ensureUser(id);
 const [record,saved,communities,signals,signalsCount,savedTopics]=await Promise.all([profileDocument(id),Bookmarked.find({userId:id}).sort({createdAt:-1}).limit(100).lean(),Community.find({members:id}).select('name board category description').limit(50).lean(),FeedSignal.find({userId:id,expiresAt:{$gt:new Date()}}).sort({updatedAt:-1}).limit(500).lean(),FeedSignal.countDocuments({userId:id,expiresAt:{$gt:new Date()}}),Tag.find({ownerId:new mongoose.Types.ObjectId(id)}).select('tagName').limit(12).lean()]);
 const preferences=preferencesOf(record);const interests=[];
 function add(topic,weight,source,reason){const words=tokens(topic,20);if(words.length)interests.push({topic:topic.slice(0,80),weight,source,reason,tokens:words});}
 for(const topic of preferences.followedTopics)add(topic,10,'followed','From a topic you follow');
 for(const topic of savedTopics)add(topic.tagName,10,'saved-topic','From a topic you saved');
 for(const bookmark of saved){const words=tokens(`${bookmark.title||''} ${bookmark.description||''}`,6);add(words.join(' '),5,'bookmark','Related to your saved stories');}
 for(const community of communities){const topics=BOARD_TOPICS[community.board]||[community.category,community.name];for(const topic of topics)if(topic)add(topic,3,'community','From a community you joined');}
 const hiddenUrls=[],hiddenTitles=[],openedUrls=[],moreUrls=[],lessUrls=[];
 for(const signal of signals){if(signal.type==='hide'){hiddenUrls.push(signal.url);if(signal.title)hiddenTitles.push(normalizedTitle(signal.title));continue;}if(signal.type==='open')openedUrls.push(signal.url);if(signal.type==='more')moreUrls.push(signal.url);if(signal.type==='less')lessUrls.push(signal.url);
  const weights={search:2,open:0.5,more:8,less:-8};const reasons={search:'Related to your recent searches',open:'Related to stories you opened',more:'Matches your feedback',less:''};const age=Math.max(0,(Date.now()-new Date(signal.updatedAt).getTime())/86400000);const decay=Math.exp(-age/30);add(signal.query||signal.title,weights[signal.type]*decay,signal.type,reasons[signal.type]);
 }
 const unique=new Map();for(const interest of interests){const key=`${interest.source}:${interest.topic.toLocaleLowerCase()}`;if(!unique.has(key)||Math.abs(unique.get(key).weight)<Math.abs(interest.weight))unique.set(key,interest);}
 const combined=[...unique.values()].sort((a,b)=>Math.abs(b.weight)-Math.abs(a.weight)||a.topic.localeCompare(b.topic)).slice(0,150);
 const retrievalTopics=[];for(const interest of combined){if(interest.weight<=0)continue;const topic=interest.source==='bookmark'?interest.tokens.slice(0,3).join(' '):interest.topic;if(topic&&!retrievalTopics.some(value=>value.toLocaleLowerCase()===topic.toLocaleLowerCase()))retrievalTopics.push(topic);if(retrievalTopics.length===2)break;}
 const recentSearches=signals.filter(signal=>signal.type==='search'&&signal.query).slice(0,12).map(signal=>({query:signal.query,at:new Date(signal.updatedAt).toISOString()}));
 const value={preferences,interests:combined,hiddenUrls:[...new Set(hiddenUrls)],hiddenTitles:[...new Set(hiddenTitles)],openedUrls:[...new Set(openedUrls)],moreUrls:[...new Set(moreUrls)],lessUrls:[...new Set(lessUrls)],signalsCount,retrievalTopics,recentSearches};
 if(profileCache.size>=200)profileCache.delete(profileCache.keys().next().value);profileCache.set(id,{at:Date.now(),value});return value;
}
function envelope(context){return{preferences:context.preferences,interests:context.interests.filter(item=>item.weight>0).slice(0,30).map(({topic,weight,source})=>({topic,weight:Math.round(weight*100)/100,source})),signalsCount:context.signalsCount};}
async function getPreferences(userId){return envelope(await getContext(userId));}
async function updatePreferences(userId,data){const patch=validatePreferences(data);await ensureUser(userId);await profileDocument(userId);const update=Object.fromEntries(Object.entries(patch).map(([key,value])=>[`preferences.${key}`,value]));if(Object.keys(update).length)await FeedProfile.updateOne({userId},{$set:update},{runValidators:true});invalidateProfile(userId);return getPreferences(userId);}
async function resetSignals(userId){await ensureUser(userId);await FeedSignal.deleteMany({userId});invalidateProfile(userId);return getPreferences(userId);}
async function recordSignal(userId,data){
 await ensureUser(userId);if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!['type','url','title','query'].includes(key)))fail('Send a supported feed signal.');
 const type=data.type;if(!['search','open','more','less','hide','unhide'].includes(type))fail('Choose a supported feed signal.');
 const title=cleanText(data.title||'',300,'Title');const query=cleanText(data.query||'',200,'Search topic');const url=canonicalUrl(data.url||'');
 if(type==='search'&&!query)fail('Include a search topic.');if(type!=='search'&&!url)fail('Include a valid HTTP or HTTPS story URL.');
 const target=type==='search'?query.toLocaleLowerCase():url;const family=['more','less'].includes(type)?'preference':type==='unhide'?'hide':type;const key=`${family}:${crypto.createHash('sha256').update(target).digest('hex')}`;
 const context=await getContext(userId);if(!context.preferences.personalized&&['open','search'].includes(type))return{recorded:false,signalsCount:context.signalsCount,message:'Personalization is paused.'};
 if(type==='unhide')await FeedSignal.deleteOne({userId,key});else{const value={type,url,title,query,expiresAt:new Date(Date.now()+RETENTION)};try{await FeedSignal.findOneAndUpdate({userId,key},{$set:value},{upsert:true,new:true,runValidators:true});}catch(error){if(error.code!==11000)throw error;await FeedSignal.findOneAndUpdate({userId,key},{$set:value},{new:true,runValidators:true});}}
 invalidateProfile(userId);return{recorded:true,type,signalsCount:await FeedSignal.countDocuments({userId,expiresAt:{$gt:new Date()}})};
}
module.exports={DEFAULT_PREFERENCES,validatePreferences,getContext,getPreferences,updatePreferences,resetSignals,recordSignal,invalidateProfile,profileCache};
