import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(project, process.argv.includes('--production') ? 'dist' : '.');
const portArg = process.argv.indexOf('--port');
const port = Number(portArg >= 0 ? process.argv[portArg + 1] : process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = file.slice(root.length);
  if (!(file === root || file.startsWith(root + sep)) || relative.split(sep).some(part => part.startsWith('.')) || !['/index.html', '/src/', '/assets/'].some(prefix => pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')) && pathname !== '/') {
    res.writeHead(404); return res.end('Not found');
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, host, () => console.log(`study studio — http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
