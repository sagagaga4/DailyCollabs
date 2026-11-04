const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const frontendRoot = path.resolve(__dirname, '../../Frontend/client');
const frontendRequire = createRequire(path.join(frontendRoot, 'package.json'));
const React = frontendRequire('react');
const { renderToStaticMarkup } = frontendRequire('react-dom/server');
const esbuild = frontendRequire('esbuild');
const registry = require('../utils/communityEmojis.json');

test('every custom token renders an accessible original glyph while unknown text stays intact', () => {
  const compiled = esbuild.buildSync({ entryPoints: [path.join(frontendRoot, 'src/components/BrandEmojis/BrandEmojis.jsx')], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react'] });
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled.outputFiles[0].text, { module: compiledModule, exports: compiledModule.exports, require: frontendRequire });
  const { EmojiText, EmojiPicker } = compiledModule.exports;
  // The picker is a default export; render it through React so search controls and labels are checked too.
  const Picker = EmojiPicker || compiledModule.exports.default;
  const tokens = registry.map(emoji => `:${emoji.id}:`).join(' ');
  const output = renderToStaticMarkup(React.createElement(EmojiText, { text: `הודעה ${tokens} :dc_unknown: :dc_spark:` }));
  assert.equal((output.match(/<svg /g) || []).length, 32);
  for (const emoji of registry) {
    assert.ok(output.includes(`dc-emoji-${emoji.id}`), emoji.id);
    assert.ok(output.includes(`aria-label="${emoji.label}"`), emoji.label);
  }
  assert.ok(output.includes('הודעה'));
  assert.ok(output.includes(':dc_unknown:'));
  const picker = renderToStaticMarkup(React.createElement(Picker, { onChoose() {} }));
  assert.equal((picker.match(/<button /g) || []).length, 31);
  assert.ok(picker.includes('Search community emojis'));
});
