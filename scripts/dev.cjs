const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const apiPort = process.env.DEV_API_PORT || '4000';
const webPort = process.env.DEV_WEB_PORT || '5173';
const aiPort = process.env.DEV_AI_PORT || '5000';
const apiUrl = `http://localhost:${apiPort}`;
const webUrl = `http://localhost:${webPort}`;
const services = [
  ['API', process.execPath, ['node_modules/nodemon/bin/nodemon.js', '--legacy-watch', '--watch', '.', '--ignore', 'agent-progress/', '--ignore', 'node_modules/', '--ext', 'js', '--delay', '0.5', 'index.js'], 'Backend', { PORT: apiPort, AI_SERVICE_URL: process.env.AI_SERVICE_URL || `http://127.0.0.1:${aiPort}`, FRONTEND_URL: webUrl }],
  ['Web', process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', webPort, '--strictPort'], 'Frontend/client', { VITE_API_URL: apiUrl, CHOKIDAR_USEPOLLING: 'true' }],
  ['Checks', process.execPath, ['scripts/quality-watch.cjs'], '.', { QUALITY_API_URL: apiUrl, QUALITY_WEB_URL: webUrl, QUALITY_AI_URL: process.env.AI_SERVICE_URL || `http://127.0.0.1:${aiPort}` }],
];
if (process.env.START_AI !== 'false') {
  const python = process.env.AI_PYTHON || path.join(root, 'ai_service/.venv/bin/python');
  if (fs.existsSync(python)) services.unshift(['AI', python, ['-B', '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', aiPort], 'ai_service', { PYTHONDONTWRITEBYTECODE: '1' }]);
  else console.warn('AI Python environment missing. Start the AI service separately.');
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 700);
}
for (const [name, command, args, cwd, overrides] of services) {
  const child = spawn(command, args, { cwd: path.join(root, cwd), env: { ...process.env, ...overrides }, stdio: 'inherit' });
  children.push(child);
  console.log(`${name} service started (PID ${child.pid})`);
  child.on('error', error => { console.error(`${name}: ${error.message}`); stop(1); });
  child.on('exit', code => { if (!stopping) { console.error(`${name} stopped (${code}).`); stop(code || 1); } });
}
console.log(`DailyCollabs: ${webUrl} · Mission control: ${webUrl}/Agents`);
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
