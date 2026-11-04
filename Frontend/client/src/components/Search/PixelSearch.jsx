import './Search.css';

export default function PixelSearch({ query = '', onCancel }) {
  return <div className="pixel-search" role="status" aria-live="polite">
    <div className="pixel-search-scene" aria-hidden="true"><div className="pixel-search-spark spark-one" /><div className="pixel-search-spark spark-two" /><svg className="pixel-search-pal" viewBox="0 0 32 32" shapeRendering="crispEdges"><path fill="var(--accent,#58d5eb)" d="M8 5h3v3h10V5h3v6h3v13h-3v3H8v-3H5V11h3z" /><path fill="var(--accent-contrast,#061216)" d="M8 12h16v10H8z" /><g className="pixel-search-eyes" fill="var(--accent,#58d5eb)"><path d="M10 14h3v4h-3zM19 14h3v4h-3z" /></g><path fill="var(--accent,#58d5eb)" d="M14 19h4v2h-4z" /><path fill="var(--accent-contrast,#061216)" d="M11 25h3v2h-3zM18 25h3v2h-3z" /><path fill="var(--text,#f2f5fa)" d="M25 18h5v2h2v5h-2v2h-5v-2h-2v-5h2z" /><path fill="var(--surface,#101318)" d="M25 20h5v5h-5z" /><path fill="var(--text,#f2f5fa)" d="M29 27h3v4h-3z" /></svg><div className="pixel-search-shadow" /></div>
    <div className="pixel-search-copy"><strong>On a little discovery mission<span className="pixel-search-dots" aria-hidden="true"><i /><i /><i /></span></strong><span>Finding stories and videos about <b>{query || 'your topic'}</b></span></div>
    {onCancel && <button type="button" className="pixel-search-cancel" onClick={onCancel} aria-label="Cancel search">Cancel</button>}
  </div>;
}
