import { useState } from 'react';
import { DraggableCard, CommunityTags } from '../CardActions';
import VideoPlayer from '../Home/VideoPlayer';
import ArticleArtwork from '../Artwork/ArticleArtwork';
import { parseVideoUrl } from '../../lib/media';
import { safeLink } from '../../lib/bookmarks';

export default function LibraryCard({ item, saved = false, onSave, onDelete, author, footer }) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const link=safeLink(item.link || item.url);
  const content={title:item.title || 'A shared thought',url:link,image:item.image,description:item.description || item.content || '',type:item.type || (parseVideoUrl(link)?'video':'article')};
  async function save(){setBusy(true);setError('');try{await onSave?.(item);}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <DraggableCard content={content} className="library-card-wrap"><article className="library-card">
    <div className="library-card-meta"><span>{author || (content.type==='video'?'WATCHLIST':'READING LIST')}</span><time>{item.pubDate && !Number.isNaN(Date.parse(item.pubDate))?new Date(item.pubDate).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Saved for later'}</time></div>
    {content.type==='video'&&parseVideoUrl(link)?<VideoPlayer url={link} title={content.title}/>:<ArticleArtwork src={item.image} url={link} title={content.title} topic={item.imageTopic || ''} isTopicImage={item.isTopicImage} credit={item.imageCredit} imagePage={item.imagePage}/>}
    <h2 dir="auto" lang={item.language || undefined}>{content.title}</h2><p className="library-card-description" dir="auto" lang={item.language || undefined}>{content.description}</p>
    {item.hashtags?.length>0&&<div className="library-post-tags">{item.hashtags.map(tag=><span key={tag}>#{tag.replace(/^#/,'')}</span>)}</div>}
    <CommunityTags content={content}/>
    {error&&<p role="alert" className="library-error">{error}</p>}
    <div className="library-card-actions">{link&&<a href={link} target={link.startsWith(window.location.origin)?undefined:'_blank'} rel="noreferrer">{content.type==='video'?'Open video':'Open story'} ↗</a>}{onSave&&<button disabled={busy} onClick={save}>{busy?'Saving…':saved?'Remove bookmark':'Save for later'}</button>}{onDelete&&<button className="library-delete" onClick={onDelete}>Remove post</button>}</div>{footer}
  </article></DraggableCard>;
}
