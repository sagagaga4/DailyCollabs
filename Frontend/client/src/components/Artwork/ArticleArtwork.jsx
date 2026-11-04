import { useId, useMemo, useState } from 'react';
import { createArtworkRecipe, safeArtworkImage, wikimediaArtworkSource } from './artworkRecipe';
import './ArticleArtwork.css';

function TopicMark({ icon }) {
  if (icon === 'sword') return <><path d="m0-76 19 26L9 43H-9l-10-93Z" /><path d="M-39 37h78M0 44v43m-13 0h26" /></>;
  if (icon === 'stack') return <>{[-35, 0, 35].map((y) => <path key={y} d={`M-65 ${y} 0 ${y - 27} 65 ${y} 0 ${y + 27}Z`} />)}</>;
  if (icon === 'wave') return <>{[-60, -40, -20, 0, 20, 40, 60].map((x, index) => <path key={x} d={`M${x} ${-([25, 45, 65, 80, 58, 42, 20][index])}v${[50, 90, 130, 160, 116, 84, 40][index]}`} />)}</>;
  if (icon === 'pixel') return <><path d="M-70-18h25v-30h32v30h25v32h-25v30h-32V14h-25Z" /><rect x="35" y="-35" width="27" height="27" /><rect x="12" y="14" width="27" height="27" /></>;
  if (icon === 'code') return <><path d="m-34-44-43 44 43 44m68-88 43 44-43 44M14-66l-29 132" /></>;
  if (icon === 'frame') return <><rect x="-77" y="-55" width="154" height="110" rx="3" /><path d="M-77-30H77M-77 30H77m-125-85v25m32-25v25m32-25v25m32-25v25M-48 30v25m32-25v25m32-25v25m32-25v25" /><path d="m-9-14 24 14-24 14Z" /></>;
  if (icon === 'globe') return <><circle r="70" /><ellipse rx="33" ry="70" /><path d="M-70 0H70M-58-37H58M-58 37H58" /></>;
  return <><circle r="43" /><ellipse rx="94" ry="32" transform="rotate(-28)" /><circle cx="66" cy="-51" r="9" /><path d="M0-100v17m0 166v17m-100-100h17m166 0h17" /></>;
}

export default function ArticleArtwork({ src, url, title, topic = '', isTopicImage, credit = '', imagePage = '', className = '', variant = 'card' }) {
  const reactId = useId();
  const id = `dc-art-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const image = safeArtworkImage(src);
  const legacyTopic = isTopicImage === undefined ? wikimediaArtworkSource(image) : null;
  const topicArtwork = Boolean(isTopicImage || legacyTopic);
  const artworkTopic = topic || legacyTopic?.topic || '';
  const recipe = useMemo(() => createArtworkRecipe({ url, title, topic: artworkTopic }), [url, title, artworkTopic]);
  const [failedImage, setFailedImage] = useState(null);
  const imageVisible = Boolean(image && failedImage !== image);
  const illustrated = !imageVisible || topicArtwork;
  const sourcePage = safeArtworkImage(imagePage || legacyTopic?.imagePage);
  const Frame = variant === 'video' ? 'span' : 'figure';
  return <Frame className={`dc-article-artwork dc-article-artwork--${variant} ${imageVisible ? topicArtwork ? 'is-topic-art' : 'is-publisher-photo' : 'is-identity-art'} ${className}`} style={{ '--art-hue': recipe.hue, '--art-second-hue': recipe.secondHue }}>
    <span className="dc-artwork-stage" data-artwork-seed={recipe.code}>
      {illustrated && <svg className="dc-identity-art-svg" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id={`${id}-wash`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={`hsl(${recipe.hue} 40% 10%)`} /><stop offset="1" stopColor={`hsl(${recipe.secondHue} 34% 21%)`} /></linearGradient><pattern id={`${id}-grid`} width={recipe.grid} height={recipe.grid} patternUnits="userSpaceOnUse" patternTransform={`rotate(${recipe.angle})`}><path d={`M${recipe.grid} 0H0V${recipe.grid}`} fill="none" stroke={`hsl(${recipe.hue} 60% 75%)`} strokeOpacity=".1" /></pattern></defs><rect width="800" height="450" fill={`url(#${id}-wash)`} /><rect width="800" height="450" fill={`url(#${id}-grid)`} /><g fill="none" stroke={`hsl(${recipe.hue} 65% 72%)`} strokeWidth="1.1" opacity=".18">{recipe.rings.map((ring, index) => <circle key={index} cx={ring.x} cy={ring.y} r={ring.r} />)}</g><g stroke={`hsl(${recipe.hue} 70% 76%)`} strokeLinecap="round" strokeWidth="4" opacity=".15" transform={`translate(${recipe.orbX} ${recipe.orbY}) rotate(${recipe.angle})`} fill="none"><TopicMark icon={recipe.icon} /></g><g fill={`hsl(${recipe.hue} 70% 80%)`} opacity=".32">{recipe.bars.map((height, index) => <rect key={index} x={25 + index * 14} y={420 - height / 4} width="3" height={height / 4} />)}</g><path d={`M${recipe.seed % 100} 0 800 ${recipe.seed % 390}`} stroke={`hsl(${recipe.secondHue} 70% 80%)`} strokeOpacity=".12" strokeWidth="2" /></svg>}
      {imageVisible && <img className="dc-artwork-image" src={image} alt={topicArtwork ? `${recipe.label} topic artwork` : ''} loading="lazy" onError={() => setFailedImage(image)} />}
      {illustrated && <span className="dc-artwork-copy"><span>{recipe.label} <i aria-hidden="true">/</i> {topicArtwork && imageVisible ? 'TOPIC ART' : 'STORY ART'}</span><strong dir="auto">{recipe.headline}</strong><small aria-hidden="true">DC—{recipe.code}</small></span>}
    </span>
    {variant !== 'video' && imageVisible && topicArtwork && sourcePage && <figcaption><a href={sourcePage} target="_blank" rel="noreferrer">{credit || 'Topic image source'} ↗</a></figcaption>}
  </Frame>;
}
