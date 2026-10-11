import base64
import json
from pathlib import Path
import struct
import zlib

root = Path(__file__).parent
public = root / 'public'

def png(size):
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            u, v = x / size, y / size
            left = abs(u - (0.5 - (v - 0.28) * 0.4)) < 0.025
            right = abs(u - (0.5 + (v - 0.28) * 0.4)) < 0.025
            bar = 0.53 < v < 0.58 and 0.39 < u < 0.61
            mark = (0.28 < v < 0.72 and (left or right)) or bar
            rows.extend((243, 242, 232) if mark else (53, 77, 60))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')

for size in (192, 512):
    (public / f'icon-{size}.png').write_bytes(png(size))
import gzip
import hashlib
import re
import html

built = root / 'build'
files = [p for p in built.rglob('*') if p.is_file() and p.name not in ['sw.js','version.json'] and not p.name.endswith('.map')]
release = hashlib.sha256(b''.join(p.read_bytes() for p in sorted(files))).hexdigest()[:12]
urls = ['/' if p.relative_to(built).as_posix() == 'index.html' else '/' + p.relative_to(built).as_posix() for p in files]
sw = (root / 'scripts/service-worker.js').read_text().replace('__CACHE__', 'atlas-release-' + release).replace('__ASSETS__', json.dumps(urls))
(built / 'sw.js').write_text(sw)
files.append(built / 'sw.js')
(built / 'version.json').write_text(json.dumps({'version':'0.11.0','release':release}))
files.append(built / 'version.json')
types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json':'application/json', '.txt':'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg':'image/jpeg'}
assets = {}
for file in files:
    path = '/' if file.name == 'index.html' else '/' + file.relative_to(built).as_posix()
    assets[path] = {'type': types[file.suffix], 'body': base64.b64encode(gzip.compress(file.read_bytes(),mtime=0)).decode()}
index = (built / 'index.html').read_text()
match = re.search(r'<meta http-equiv="content-security-policy" content="([^"]+)"', index)
csp = html.unescape(match.group(1)) if match else "script-src 'self'; style-src 'self' 'unsafe-inline'"
csp += "; default-src 'self'; img-src 'self' data:; connect-src 'self' https://*.wikipedia.org https://www.wikidata.org https://commons.wikimedia.org https://upload.wikimedia.org https://collectionapi.metmuseum.org https://images.metmuseum.org; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; form-action 'self'"
source = 'const assets = ' + json.dumps(assets) + ';\nconst csp=' + json.dumps(csp) + ';\n' + """export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405, headers: {Allow: 'GET, HEAD'}});
    if (path === '/health') return Response.json({status: 'ok', version: '0.11.0'});
    const asset = assets[path];
    if (!asset) return new Response('Not found', {status: 404});
    const bytes = Uint8Array.from(atob(asset.body), c => c.charCodeAt(0));
    return new Response(request.method === 'HEAD' ? null : bytes, {encodeBody: 'manual', headers: {
      'Content-Type': asset.type,
      'Content-Encoding': 'gzip',
      'Cache-Control': path.startsWith('/_app/immutable/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': csp
    }});
  }
};
"""
(root / 'worker.mjs').write_text(source)
print('Built release', release, 'with', len(assets), 'assets; Worker bytes',len(source))
