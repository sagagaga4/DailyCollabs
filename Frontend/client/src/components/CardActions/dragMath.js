export const LONG_PRESS_MS = 480;
export const PRESS_MOVE_LIMIT = 10;
export const DROP_RADIUS = 43;
export const ACTION_LABELS = { community: 'Community', repost: 'My channel', share: 'Share' };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function movedBeyondPress(start, point, limit = PRESS_MOVE_LIMIT) {
  return Math.hypot(point.x - start.x, point.y - start.y) > limit;
}

export function createActionTargets(anchor, viewport) {
  const width = Math.max(220, Number(viewport.width) || 1024);
  const height = Math.max(180, Number(viewport.height) || 768);
  const gap = Math.min(94, (width - 90) / 2);
  const center = clamp(anchor.x, 45 + gap, width - 45 - gap);
  const y = clamp(anchor.y - 112, 58, height - 68);
  return ['community', 'repost', 'share'].map((id, index) => ({ id, x: center + (index - 1) * gap, y }));
}

export function closestAction(point, targets, radius = DROP_RADIUS) {
  let nearest = null;
  let distance = radius;
  for (const target of targets) {
    const candidate = Math.hypot(point.x - target.x, point.y - target.y);
    if (candidate <= distance) { nearest = target.id; distance = candidate; }
  }
  return nearest;
}

export function resolveDropAction(origin, point, targets) {
  return movedBeyondPress(origin, point, 16) ? closestAction(point, targets) : null;
}
