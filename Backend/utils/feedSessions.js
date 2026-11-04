const {randomUUID}=require('node:crypto');
function createFeedSessions({now=Date.now,ttl=10*60*1000,max=100}={}){
 const entries=new Map();
 function prune(){for(const[id,item]of entries)if(now()-item.createdAt>ttl)entries.delete(id);while(entries.size>=max)entries.delete(entries.keys().next().value);}
 return{
  create(owner,key,records,metadata){prune();const entry={id:randomUUID(),owner:String(owner||'anonymous'),key,records,metadata,createdAt:now()};entries.set(entry.id,entry);return entry;},
  get(id,owner,key){const entry=entries.get(id);if(!entry||entry.owner!==String(owner||'anonymous')||entry.key!==key||now()-entry.createdAt>ttl)return null;return entry;},
  latest(owner,key){const matches=[...entries.values()].filter(entry=>entry.owner===String(owner||'anonymous')&&entry.key===key&&now()-entry.createdAt<=ttl);return matches.at(-1)||null;},
  clear(){entries.clear();},size:()=>entries.size,
 };
}
module.exports={createFeedSessions};
