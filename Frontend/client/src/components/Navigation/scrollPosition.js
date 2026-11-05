function activeScope(container) {
  return container || document.querySelector('[data-page-active="true"]') || document;
}

export function captureScrollPosition(container) {
  const scope = activeScope(container);
  const position = { x: window.scrollX || 0, y: window.scrollY || 0 };
  const anchor = [...scope.querySelectorAll('[data-scroll-anchor]')].find(element => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0;
  });
  if (anchor) position.anchor = { key: anchor.getAttribute('data-scroll-anchor'), top: anchor.getBoundingClientRect().top };
  return position;
}

/** Restore document scroll; container only scopes stable card anchors. */
export function restoreScrollPosition(position = { x: 0, y: 0 }, { container, duration = 1800 } = {}) {
  const scope = activeScope(container);
  let stopped = false; let frame; let timer; let observer;
  const cancel = () => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame); clearTimeout(timer); observer?.disconnect();
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.removeEventListener(event, cancel, true);
  };
  const restore = () => {
    if (stopped || (scope !== document && (!scope.isConnected || scope.hidden))) return;
    let top = Number.isFinite(position.y) ? position.y : 0;
    if (position.anchor) {
      const anchor = [...scope.querySelectorAll('[data-scroll-anchor]')].find(element => element.getAttribute('data-scroll-anchor') === position.anchor.key);
      if (anchor?.getBoundingClientRect().width) top = window.scrollY + anchor.getBoundingClientRect().top - position.anchor.top;
    }
    window.scrollTo({ left: Number.isFinite(position.x) ? position.x : 0, top: Math.max(0, top), behavior: 'instant' });
  };
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(restore); };
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(event, cancel, { capture: true, passive: true });
  if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(schedule); observer.observe(scope === document ? document.body : scope); }
  restore(); frame = requestAnimationFrame(() => { restore(); frame = requestAnimationFrame(restore); });
  timer = setTimeout(cancel, duration);
  return cancel;
}
