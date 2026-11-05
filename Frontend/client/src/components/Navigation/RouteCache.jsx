import { Component } from 'react';
import { PageActivityProvider } from './PageActivity';
import { captureScrollPosition, restoreScrollPosition } from './scrollPosition';
import { createPageCache, locationIdentity, pageCacheKey, visitPage } from './pageCache';
import './RouteCache.css';

/** Capture scroll before React hides the outgoing page and the browser clamps it. */
export default class RouteCache extends Component {
  constructor(props) {
    super(props);
    this.state = props.validLocation ? visitPage(createPageCache(props.owner), props.owner, props.location) : createPageCache(props.owner);
    this.nodes = new Map(); this.positions = new Map(); this.historyPositions = new Map(); this.focused = new Map();
    this.cancelRestore = null;
  }

  static getDerivedStateFromProps(props, state) {
    if (!props.validLocation) return state.owner === props.owner ? null : createPageCache(props.owner);
    const next = visitPage(state, props.owner, props.location);
    return next === state ? null : next;
  }

  componentDidMount() {
    this.previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.addEventListener('scroll', this.captureCurrent, { passive: true });
    document.addEventListener('focusin', this.captureFocus);
    this.restoreCurrent(true);
  }

  getSnapshotBeforeUpdate(previous) {
    if (locationIdentity(previous.location) === locationIdentity(this.props.location) && previous.owner === this.props.owner) return null;
    if (previous.validLocation) {
      const key = pageCacheKey(previous.location); const node = this.nodes.get(key);
      if (node) {
        const position = captureScrollPosition(node);
        this.positions.set(key, position); this.historyPositions.set(previous.location.key || 'default', position);
        if (node.contains(document.activeElement)) this.focused.set(key, document.activeElement);
        // Native media can stop before hidden-page effects run. SDK playback
        // follows the PageActivityProvider signal after the commit.
        const leavingPage = previous.owner !== this.props.owner || !this.props.validLocation || key !== pageCacheKey(this.props.location);
        if (leavingPage) node.querySelectorAll('video,audio').forEach(media => media.pause());
      }
    }
    return true;
  }

  componentDidUpdate(_previous, _state, navigated) {
    const present = new Set(this.state.entries.map(entry => entry.key));
    for (const map of [this.nodes, this.positions, this.focused]) for (const key of map.keys()) if (!present.has(key)) map.delete(key);
    while (this.historyPositions.size > 64) this.historyPositions.delete(this.historyPositions.keys().next().value);
    if (navigated) this.restoreCurrent();
  }

  componentWillUnmount() {
    this.cancelRestore?.();
    window.removeEventListener('scroll', this.captureCurrent); document.removeEventListener('focusin', this.captureFocus);
    window.history.scrollRestoration = this.previousRestoration || 'auto';
    this.positions.clear(); this.historyPositions.clear(); this.focused.clear(); this.nodes.clear();
  }

  captureCurrent = () => {
    if (!this.props.validLocation) return;
    const key = pageCacheKey(this.props.location); const node = this.nodes.get(key);
    if (!node || node.hidden) return;
    const position = captureScrollPosition(node);
    this.positions.set(key, position); this.historyPositions.set(this.props.location.key || 'default', position);
  };

  captureFocus = event => {
    const key = pageCacheKey(this.props.location); const node = this.nodes.get(key);
    if (node?.contains(event.target)) this.focused.set(key, event.target);
  };

  restoreCurrent = (initial = false) => {
    this.cancelRestore?.();
    if (!this.props.validLocation) return;
    const key = pageCacheKey(this.props.location); const node = this.nodes.get(key);
    if (!node) return;
    const historyPosition = this.props.navigationType === 'POP' ? this.historyPositions.get(this.props.location.key || 'default') : null;
    let position = historyPosition || this.positions.get(key);
    if (!position && this.props.location.hash) {
      try {
        const target = document.getElementById(decodeURIComponent(this.props.location.hash.slice(1)));
        if (target && node.contains(target)) position = { x: 0, y: window.scrollY + target.getBoundingClientRect().top };
      } catch { /* Invalid hashes are harmless and fall back to the page top. */ }
    }
    if (!initial) {
      const focused = this.focused.get(key);
      (focused?.isConnected && node.contains(focused) && focused.getClientRects().length ? focused : node).focus({ preventScroll: true });
    }
    this.cancelRestore = restoreScrollPosition(position || { x: 0, y: 0 }, { container: node });
  };

  render() {
    const activeKey = this.props.validLocation ? pageCacheKey(this.props.location) : null;
    return this.state.entries.map(entry => {
      const active = entry.key === activeKey;
      return <div key={entry.key} ref={node => { if (node) this.nodes.set(entry.key, node); else this.nodes.delete(entry.key); }} className="dc-cached-page" data-page-active={String(active)} hidden={!active} inert={!active} aria-hidden={!active} tabIndex={-1}>
        <PageActivityProvider active={active}>{this.props.renderPage(entry.location)}</PageActivityProvider>
      </div>;
    });
  }
}
