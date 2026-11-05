import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageActive } from '../Navigation/PageActivity';
import { API_URL } from '../../config';
import './Agents.css';

const labels = { queued: 'Queued', building: 'Building', checking: 'Checking', fixing: 'Correcting', review: 'In review', ready: 'Ready for a mission', blocked: 'Needs attention' };
function time(value) { return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'; }

export default function Agents() {
  const pageActive = usePageActive();
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!pageActive) return;
    let alive = true;
    const controller = new AbortController();
    setConnected(false);
    fetch(`${API_URL}/agent-status`, { signal: controller.signal }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(value => { if (alive) setData(value); }).catch(() => {});
    const stream = new EventSource(`${API_URL}/agent-status/stream`);
    stream.onopen = () => setConnected(true);
    stream.onmessage = event => { try { setData(JSON.parse(event.data)); setConnected(true); } catch { /* wait for next snapshot */ } };
    stream.onerror = () => setConnected(false);
    return () => { alive = false; controller.abort(); stream.close(); };
  }, [pageActive]);
  const agents = data?.agents || [];
  const ready = agents.filter(agent => agent.status === 'ready');
  const active = agents.filter(agent => ['building', 'checking', 'fixing', 'review'].includes(agent.status));
  const events = agents.flatMap(agent => (agent.events || []).map(event => ({ ...event, id: agent.id, name: agent.short }))).sort((a, b) => b.at.localeCompare(a.at));
  const visibleEvents = selected ? events.filter(event => event.id === selected) : events;
  const monitor = data?.monitor;
  const checks = monitor?.checks || [];
  return (
    <main className="agents-page">
      <header className="agents-heading">
        <div><span className="agents-eyebrow">DAILYCOLLABS WORKSPACE</span><h1>Mission control<span>.</span></h1><p>Four specialists. One shared direction.</p></div>
        <span className={`agents-connection ${connected ? 'is-live' : ''}`}><i />{connected ? 'Live updates' : 'Reconnecting…'}</span>
      </header>
      <section className="agents-overview" aria-label="Team overview">
        <div><span>TEAM</span><strong>{agents.length || '4'}<small>specialist agents</small></strong></div>
        <div><span>IN PROGRESS</span><strong>{active.length}<small>building & reviewing</small></strong></div>
        <div><span>AVAILABLE</span><strong className="agents-ready-number">{ready.length}<small>ready for another mission</small></strong></div>
        <div><span>QUALITY LOOP</span><strong className="agents-quality-text">{monitor?.status === 'checking' ? 'Checking' : monitor?.status === 'passed' ? 'Watching' : monitor?.status === 'failed' ? 'Needs review' : 'Starting'}<small>checks on saved source changes</small></strong></div>
      </section>
      <div className="agents-section-title"><h2>The crew</h2><span>PLAN <b>→</b> BUILD <b>→</b> CHECK <b>→</b> CORRECT <b>→</b> READY</span></div>
      {!data && <div className="agents-loading" role="status">Connecting to the local progress service…</div>}
      <section className="agents-grid" aria-label="Agent missions">
        {agents.map(agent => <article key={agent.id} className={`agent-card agent-status-${agent.status}`}>
          <div className="agent-card-top"><span className="agent-symbol" aria-hidden="true">{agent.icon}</span><span className="agent-number">AGENT 0{agent.id}</span><span className={`agent-status status-${agent.status}`}><i />{labels[agent.status] || agent.status}</span></div>
          <h3>{agent.name}</h3><p className="agent-mission">{agent.mission}</p>
          <div className="agent-progress-label"><span>Mission progress</span><strong>{agent.progress}%</strong></div>
          <progress value={agent.progress} max="100" aria-label={`Agent ${agent.id} progress`} />
          <p className="agent-current"><span>↳</span>{agent.message}</p>
          {agent.research?.siteCount > 0 && <details className="agent-research"><summary>{agent.research.siteCount} different sites reviewed <span>View sources ↗</span></summary><ul>{agent.research.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<span>↗</span></a></li>)}</ul></details>}
          <div className="agent-footer"><span>{agent.scope}</span><button type="button" onClick={() => setSelected(selected === agent.id ? null : agent.id)} aria-pressed={selected === agent.id}>View log ↗</button></div>
        </article>)}
      </section>
      <div className="agents-bottom-grid">
        <section className="agents-activity"><div className="agents-panel-heading"><h2>{selected ? `Agent 0${selected} activity` : 'Activity stream'}</h2>{selected ? <button onClick={() => setSelected(null)}>Show all</button> : <span>REAL TIME</span>}</div>
          <ol>{visibleEvents.slice(0, 16).map((event, index) => <li key={`${event.id}-${event.at}-${index}`}><time dateTime={event.at}>{time(event.at)}</time><span className={`activity-dot status-${event.status}`} /><div><strong>Agent 0{event.id} <span>{event.name}</span></strong><p>{event.message}</p></div></li>)}</ol>
          {!visibleEvents.length && <p className="agents-empty">Updates will appear as agents work.</p>}
        </section>
        <aside className="agents-side-panels"><section className="agents-availability"><div className="agents-panel-heading"><h2>Ready room</h2><span>{ready.length} AVAILABLE</span></div>{ready.length ? ready.map(agent => <div className="agent-available" key={agent.id}><span className="ready-avatar">0{agent.id}</span><div><strong>{agent.short}</strong><p>Reviewed · ready for another mission</p></div><span className="ready-dot" /></div>) : <p className="agents-empty">Agents appear here after their checks and integration review pass.</p>}<p className="agents-note">Give the next mission in this chat. Available agents can pick it up during an active session.</p></section>
          <section className="agents-checks"><div className="agents-panel-heading"><h2>Automatic checks</h2><span>{time(monitor?.updatedAt)}</span></div>{checks.map(check => <div className="agent-check" key={check.name}><span className={check.ok ? 'check-pass' : 'check-fail'}>{check.ok ? '✓' : '!'}</span><div><strong>{check.name}</strong><p>{check.detail}</p></div></div>)}<p className="agents-note">{monitor?.message || 'The local watcher checks builds and service health.'} Coding agents review and correct during active work; the watcher reports regressions.</p></section>
        </aside>
      </div>
      <footer className="agents-page-footer"><span>Built in the open. Every status comes from a real task update.</span><Link to="/">Back to the feed ↗</Link></footer>
    </main>
  );
}
