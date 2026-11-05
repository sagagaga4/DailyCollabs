import { useEffect, useId, useRef, useState } from 'react';
import { contentRequest } from '../CardActions/contentApi';
import { parseVideoUrl } from '../../lib/media';
import { usePageActive } from '../Navigation/PageActivity';
import './ShareVideoButton.css';

function VideoComposer({ close, onPublished }) {
  const pageActive = usePageActive();
  const dialog = useRef(null);
  const id = useId();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const media = parseVideoUrl(url);
  useEffect(() => {
    const element = dialog.current;
    if (pageActive) element.showModal();
    return () => element.close();
  }, [pageActive]);
  async function publish(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const post = await contentRequest('/media', { method: 'POST', body: JSON.stringify({ videoUrl: url, title, caption, transcript }) });
      window.dispatchEvent(new CustomEvent('dailycollabs:media', { detail: { action: 'published', post } }));
      onPublished?.(post); close();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="dc-share-video-dialog" aria-labelledby={`${id}-heading`} onCancel={(event) => { event.preventDefault(); if (!busy) close(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) close(); }}><div className="dc-share-video-inner"><header><div><span>BRING SOMETHING GOOD</span><h2 id={`${id}-heading`}>Worth a watch.</h2></div><button type="button" onClick={close} disabled={busy} aria-label="Close video composer">×</button></header><p>Share a YouTube, Vimeo, or direct HTTPS MP4 / WebM video with your people.</p><form onSubmit={publish}><label htmlFor={`${id}-url`}>Video link</label><input id={`${id}-url`} type="url" autoFocus required maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" /><span className={`dc-share-video-validation ${media ? 'is-valid' : ''}`}>{url ? media ? `✓ ${media.label} link ready` : 'Use a supported HTTPS video link.' : 'The original creator’s player stays in control.'}</span><label htmlFor={`${id}-title`}>Title</label><input id={`${id}-title`} dir="auto" required minLength={3} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What makes this worth watching?" /><label htmlFor={`${id}-caption`}>Your take <span>(optional)</span></label><textarea id={`${id}-caption`} dir="auto" maxLength={500} rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Give the community a little context…" /><details className="dc-share-video-transcript"><summary>Add a transcript or visual description</summary><label htmlFor={`${id}-transcript`}>Transcript <span>(optional)</span></label><textarea id={`${id}-transcript`} dir="auto" maxLength={8000} rows={5} value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Include spoken words and any important visual details." /><small>{transcript.length.toLocaleString()}/8,000</small></details>{error && <p className="dc-share-video-error" role="alert">{error}</p>}<footer><span>{caption.length}/500</span><button type="submit" disabled={busy || !media || title.trim().length < 3}>{busy ? 'Sharing…' : 'Share video ↗'}</button></footer></form></div></dialog>;
}

export default function ShareVideoButton({ onPublished, className = '' }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={`dc-share-video-button ${className}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>＋ Share a video</button>{open && <VideoComposer close={() => setOpen(false)} onPublished={onPublished} />}</>;
}
