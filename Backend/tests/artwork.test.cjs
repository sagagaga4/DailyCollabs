const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire, Module } = require('node:module');
const base = path.resolve(__dirname, '../../Frontend/client');
const recipeModule = () => import(pathToFileURL(path.join(base, 'src/components/Artwork/artworkRecipe.js')).href);

test('different missing-image cards receive distinct stable full-identity artwork, including shared Skyrim topics', async () => {
  const { createArtworkRecipe } = await recipeModule();
  const items = Array.from({ length: 100 }, (_, index) => ({ url: `https://publisher.example/skyrim/${index}`, title: 'A new Skyrim discovery', topic: 'Skyrim' }));
  const recipes = items.map(createArtworkRecipe);
  assert.equal(new Set(recipes.map((recipe) => recipe.code)).size, 100);
  assert.equal(new Set(recipes.map((recipe) => JSON.stringify([recipe.hue, recipe.angle, recipe.grid, recipe.rings, recipe.bars]))).size, 100);
  assert.deepEqual(createArtworkRecipe(items[0]), recipes[0]);
  assert.equal(createArtworkRecipe({ ...items[0], url: `${items[0].url}?utm_source=test#section` }).seed, recipes[0].seed);
  assert.equal(createArtworkRecipe({ ...items[0], topic: '' }).seed, recipes[0].seed, 'A shared topic or changing search must not replace the story identity.');
  assert.notEqual(createArtworkRecipe({ ...items[0], title: 'A different story title' }).seed, recipes[0].seed);
});

test('topic marks support Skyrim, Redis, and Unicode titles; unusable image inputs do not become shared false/blank assets', async () => {
  const { createArtworkRecipe, safeArtworkImage, wikimediaArtworkSource } = await recipeModule();
  assert.equal(createArtworkRecipe({ url: 'https://a.test/1', title: 'A Redis database release' }).icon, 'stack');
  assert.equal(createArtworkRecipe({ url: 'https://a.test/2', title: 'סקיירים: מסע חדש' }).icon, 'sword');
  for (const value of [false, null, undefined, '', '  ', 'javascript:alert(1)', 'data:image/svg+xml,x', 'https://user:pass@example.com/a.png']) assert.equal(safeArtworkImage(value), null);
  assert.equal(wikimediaArtworkSource('https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Redis_logo.svg/960px-Redis_logo.svg.png').imagePage, 'https://commons.wikimedia.org/wiki/File:Redis_logo.svg');
  assert.equal(wikimediaArtworkSource('https://publisher.example/photo.jpg'), null);
  assert.equal(wikimediaArtworkSource('https://upload.wikimedia.org/wikipedia/commons/2/2f/%ZZ.png'), null);
});

test('rendered fallback cards have unique SVG IDs and safe labels; video posters contain no caption links', () => {
  const frontendRequire = createRequire(path.join(base, 'package.json'));
  const React = frontendRequire('react');
  const { renderToStaticMarkup } = frontendRequire('react-dom/server');
  const esbuild = frontendRequire('esbuild');
  const source = path.join(base, 'src/components/Artwork/ArticleArtwork.jsx');
  const code = esbuild.buildSync({ entryPoints: [source], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react', 'react/*'], loader: { '.css': 'empty' } }).outputFiles[0].text;
  const filename = path.join(base, 'artwork-test-compiled.cjs');
  const compiled = new Module(filename, module);
  compiled.paths = Module._nodeModulePaths(base);
  compiled._compile(code, filename);
  const ArticleArtwork = compiled.exports.default;
  const html = renderToStaticMarkup(React.createElement('div', null,
    React.createElement(ArticleArtwork, { url: 'https://a.test/1', title: '<script>first</script>', src: false }),
    React.createElement(ArticleArtwork, { url: 'https://a.test/2', title: 'Second missing image', src: ' ' }),
    React.createElement(ArticleArtwork, { url: 'https://a.test/3', title: 'Skyrim story', src: 'https://upload.wikimedia.org/wikipedia/en/1/15/Skyrim.png', isTopicImage: true, imagePage: 'https://en.wikipedia.org/wiki/Skyrim', variant: 'video' }),
  ));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, 6); assert.equal(new Set(ids).size, ids.length);
  assert.match(html, /STORY ART/); assert.ok(!html.includes('<script>')); assert.ok(!html.includes('src="false"')); assert.ok(!html.includes('<figcaption>'));
  const seeds = [...html.matchAll(/data-artwork-seed="([^"]+)"/g)].map((match) => match[1]); assert.equal(new Set(seeds).size, 3);
});
