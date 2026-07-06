import https from 'https';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');
const root = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.gd': 'text/plain',
  '.cs': 'text/plain',
  '.yaml': 'text/plain',
  '.md': 'text/markdown',
};

// Simple token auth for the editor
const EDITOR_TOKEN = 'ckedit2026';

function serveFile(res, req, filePath, mimeType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const headers = {
      'Content-Type': mimeType || MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    };
    // Gzip if client supports it and file is large enough
    const acceptEncoding = (req && req.headers && req.headers['accept-encoding']) || '';
    if (acceptEncoding.includes('gzip') && data.length > 1024) {
      headers['Content-Encoding'] = 'gzip';
      zlib.gzip(data, (err2, compressed) => {
        if (err2) {
          res.writeHead(200, headers);
          res.end(data);
          return;
        }
        res.writeHead(200, headers);
        res.end(compressed);
      });
    } else {
      res.writeHead(200, headers);
      res.end(data);
    }
  });
}

const server = https.createServer({
  key: fs.readFileSync('/root/concrete-kingdom/key.pem'),
  cert: fs.readFileSync('/root/concrete-kingdom/cert.pem'),
}, (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  // ── Editor UI ──
  if (pathname === '/editor') {
    serveFile(res, path.join(root, 'public/editor.html'), 'text/html');
    return;
  }

  // ── Editor API: list files ──
  if (pathname === '/api/editor/files' && req.method === 'GET') {
    if (url.searchParams.get('token') !== EDITOR_TOKEN) {
      res.writeHead(401); res.end('Unauthorized'); return;
    }
    const dir = url.searchParams.get('dir') || 'src';
    const basePath = path.join(root, dir);
    function walk(dirPath) {
      const entries = [];
      try {
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
          if (entry.name.startsWith('.')) continue;
          if (entry.name === 'node_modules') continue;
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            entries.push(...walk(fullPath));
          } else {
            entries.push(fullPath.replace(root, ''));
          }
        }
      } catch (e) {}
      return entries;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(walk(basePath)));
    return;
  }

  // ── Editor API: read file ──
  if (pathname === '/api/editor/read' && req.method === 'GET') {
    if (url.searchParams.get('token') !== EDITOR_TOKEN) {
      res.writeHead(401); res.end('Unauthorized'); return;
    }
    const file = url.searchParams.get('file');
    if (!file) { res.writeHead(400); res.end('No file specified'); return; }
    const fullPath = path.join(root, file);
    if (!fullPath.startsWith(root)) { res.writeHead(403); res.end('Invalid path'); return; }
    serveFile(res, fullPath, 'text/plain');
    return;
  }

  // ── Editor API: write file ──
  if (pathname === '/api/editor/write' && req.method === 'POST') {
    if (url.searchParams.get('token') !== EDITOR_TOKEN) {
      res.writeHead(401); res.end('Unauthorized'); return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const file = data.file;
        const content = data.content;
        if (!file || content === undefined) { res.writeHead(400); res.end('Missing file or content'); return; }
        const fullPath = path.join(root, file);
        if (!fullPath.startsWith(root)) { res.writeHead(403); res.end('Invalid path'); return; }
        fs.writeFileSync(fullPath, content);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500);
        res.end('Error: ' + e.message);
      }
    });
    return;
  }

  // ── Static file serving ──
  let filePath = path.join(dist, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(dist, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(443, '0.0.0.0', () => {
  console.log('Concrete Kingdom server running on https://88.99.15.139:443');
  console.log('Game:    https://88.99.15.139/');
  console.log('Editor:  https://88.99.15.139/editor');
});
