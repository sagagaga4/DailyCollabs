import { toActionContent } from './recommendations.js';

export function buildShareTargets(value) {
  const content = toActionContent(value);
  if (!content) return null;
  const text = `${content.title}\n${content.url}`;
  return { whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`, email: `mailto:?subject=${encodeURIComponent(content.title)}&body=${encodeURIComponent(text)}`, instagram: 'https://www.instagram.com/' };
}
