import { spawn } from 'node:child_process';
import { open, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');
const origin = `http://127.0.0.1:${port}`;
const logPath = join(tmpdir(), `zhixu-preview-${port}.log`);

async function isReady() {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(1500) });
    return response.ok && (await response.text()).includes('<title>知序 · 按自己的节奏学习</title>');
  } catch { return false; }
}

if (!(await isReady())) {
  const log = await open(logPath, 'a');
  const child = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '0.0.0.0' },
    detached: true,
    stdio: ['ignore', log.fd, log.fd]
  });
  let spawnError;
  child.on('error', error => { spawnError = error; });
  child.unref();
  await log.close();
  for (let attempt = 0; attempt < 40 && !(await isReady()); attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!(await isReady())) {
    throw new Error(`Preview did not start. See ${logPath}\n${(await readFile(logPath, 'utf8')).slice(-1500)}`);
  }
}

console.log(`知序已就绪，转发端口：${port}。`);
const name = process.env.CODESPACE_NAME;
const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
if (name && domain && /^[a-z0-9-]+$/.test(name) && /^[a-z0-9.-]+$/.test(domain)) {
  console.log(`浏览器预览：https://${name}-${port}.${domain}`);
  console.log('在 Ports 面板确认端口可见性为 Private；仅授权用户登录 GitHub 后访问。');
} else {
  console.log('此脚本在 GitHub Codespaces 中会自动打开预览；当前只验证本机启动。');
}
