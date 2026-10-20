#!/usr/bin/env node
/** Small local development server; the library itself remains CSS-only. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const args = process.argv.slice(2);
const portArgument = args[0] === '--port' ? args[1] : args[0];
const port = portArgument === undefined ? 8765 : Number(portArgument);
if ((args[0] === '--port' ? args.length !== 2 : args.length > 1) || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: node scripts/serve.mjs [port]  (default: 8765)');
  process.exit(1);
}

const mimeTypes = {
  '.html':'text/html; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.webp':'image/webp', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8',
  '.md':'text/plain; charset=utf-8'
};
const insideProject = filename => {
  const relative = path.relative(projectRoot,filename);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

const server = createServer(async (request,response) => {
  const reply = (status, message) => {
    response.writeHead(status, {'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'});
    response.end(request.method === 'HEAD' ? undefined : message);
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow','GET, HEAD'); reply(405,'Method not allowed'); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname); }
  catch { reply(400,'Invalid URL'); return; }
  if (/[\u0000-\u001f\\:]/.test(pathname) || pathname.split('/').some(segment => segment.startsWith('.'))) {
    reply(403,'Forbidden'); return;
  }
  if (pathname === '/') {
    response.writeHead(302, {Location:'/demo/','Cache-Control':'no-store'}); response.end(); return;
  }
  let filename = path.resolve(projectRoot,`.${pathname}`);
  if (!insideProject(filename)) { reply(403,'Forbidden'); return; }
  try {
    filename = await realpath(filename);
    if (!insideProject(filename)) { reply(403,'Forbidden'); return; }
    let details = await stat(filename);
    if (details.isDirectory()) {
      if (!pathname.endsWith('/')) {
        response.writeHead(302, {Location:`${pathname.split('/').map(encodeURIComponent).join('/')}/`,'Cache-Control':'no-store'});
        response.end(); return;
      }
      filename = await realpath(path.join(filename,'index.html'));
      if (!insideProject(filename)) { reply(403,'Forbidden'); return; }
      details = await stat(filename);
    }
    if (!details.isFile()) { reply(404,'Not found'); return; }
    response.writeHead(200, {
      'Content-Type':mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'Content-Length':details.size,
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    });
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(filename);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch (error) {
    reply(error.code === 'EACCES' || error.code === 'EPERM' ? 403 : 404, 'Not found');
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Choose another port.` : error.message);
  process.exitCode = 1;
});
server.listen(port,'127.0.0.1',() => console.log(`PandoraBox UI Playground: http://localhost:${port}/demo/`));
