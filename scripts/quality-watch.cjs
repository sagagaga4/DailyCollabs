const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const statusFile = path.join(root, 'Backend/agent-progress/quality.json');
const api = process.env.QUALITY_API_URL || 'http://localhost:4000';
const web = process.env.QUALITY_WEB_URL || 'http://localhost:5173';
const ai = process.env.QUALITY_AI_URL || 'http://localhost:5000';
let lastSignature = '';
let lastBuild = null;
let lastTests = null;
let running = false;
let stopped = false;
const checks = [];
function save(status, message) {
  fs.mkdirSync(path.dirname(statusFile), { recursive: true });
  fs.writeFileSync(`${statusFile}.tmp`, JSON.stringify({ status, message, updatedAt: new Date().toISOString(), checks }, null, 2));
  fs.renameSync(`${statusFile}.tmp`, statusFile);
}
function signature(dir) {
  const parts = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.venv', 'dist', 'agent-progress'].includes(entry.name) || entry.name.startsWith('.env')) continue;
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) parts.push(signature(name));
    else if (/\.(jsx?|css|cjs|mjs|json|py)$/.test(entry.name)) { const stat = fs.statSync(name); parts.push(`${name}:${stat.mtimeMs}:${stat.size}`); }
  }
  return parts.join('|');
}
function command(cmd, args, cwd) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output = (output + chunk).slice(-18000); });
    child.stderr.on('data', chunk => { output = (output + chunk).slice(-18000); });
    const timer = setTimeout(() => child.kill('SIGTERM'), 90000);
    child.on('error', error => { clearTimeout(timer); resolve({ ok: false, output: error.message }); });
    child.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, output }); });
  });
}
async function health(name, url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { name, ok: response.ok, detail: response.ok ? 'Responding normally' : `HTTP ${response.status}` };
  } catch { return { name, ok: false, detail: 'Service is not responding' }; }
}
async function run() {
  if (running || stopped) return;
  running = true;
  try {
    const next = signature(path.join(root, 'Frontend/client/src')) + signature(path.join(root, 'Backend'));
    if (next !== lastSignature) {
      save('checking', 'Saved source changed. Running a fresh production build.');
      const result = await command('npm', ['run', 'build'], path.join(root, 'Frontend/client'));
      lastBuild = { name: 'Production build', ok: result.ok, detail: result.ok ? 'Frontend compiled successfully' : 'Build failed; review the local check log' };
      fs.writeFileSync(path.join(root, 'Backend/agent-progress/build.log'), result.output);
      const testDir = path.join(root, 'Backend/tests');
      const testFiles = fs.existsSync(testDir) ? fs.readdirSync(testDir).filter(name => name.endsWith('.test.cjs')).map(name => path.join(testDir, name)) : [];
      if (testFiles.length) {
        const tests = await command(process.execPath, ['--test', ...testFiles], root);
        lastTests = { name: 'Feature behavior checks', ok: tests.ok, detail: tests.ok ? 'Feature behavior checks passed' : 'A feature check failed; review the local check log' };
        fs.writeFileSync(path.join(root, 'Backend/agent-progress/tests.log'), tests.output);
      }
      lastSignature = next;
    }
    const results = await Promise.all([health('App server', web), health('API & MongoDB', `${api}/health`), health('AI service', `${ai}/health`)]);
    checks.splice(0, checks.length, ...(lastBuild ? [lastBuild] : []), ...(lastTests ? [lastTests] : []), ...results);
    const ok = checks.every(check => check.ok);
    save(ok ? 'passed' : 'failed', ok ? 'Watching for source changes. Service health refreshes every 15 seconds.' : 'A check needs attention. Coding agents can investigate during an active session.');
    console.log(`[${new Date().toISOString()}] ${ok ? 'PASS' : 'FAIL'} ${checks.map(check => `${check.name}: ${check.ok ? 'ok' : 'failed'}`).join(' · ')}`);
  } catch (error) { save('failed', `Check could not finish: ${error.message}`); }
  finally { running = false; }
}
const timer = setInterval(run, 15000);
process.on('SIGTERM', () => { stopped = true; clearInterval(timer); process.exit(0); });
process.on('SIGINT', () => { stopped = true; clearInterval(timer); process.exit(0); });
run();
