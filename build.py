import base64
import json
from pathlib import Path
import struct
import zlib

root = Path(__file__).parent
version = json.loads((root / 'package.json').read_text())['version']
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
import hashlib
import re
import html

built = root / 'build'
files = [p for p in built.rglob('*') if p.is_file() and p.name not in ['sw.js','version.json','_headers'] and not p.name.endswith('.map')]
release = hashlib.sha256(b''.join(p.read_bytes() for p in sorted(files))).hexdigest()[:12]
urls = ['/' if p.relative_to(built).as_posix() == 'index.html' else '/' + p.relative_to(built).as_posix() for p in files]
sw = (root / 'scripts/service-worker.js').read_text().replace('__CACHE__', 'atlas-release-' + release).replace('__ASSETS__', json.dumps(urls))
(built / 'sw.js').write_text(sw)
(built / 'version.json').write_text(json.dumps({'version':version,'release':release}))
index = (built / 'index.html').read_text()
match = re.search(r'<meta http-equiv="content-security-policy" content="([^"]+)"', index)
csp = html.unescape(match.group(1)) if match else "script-src 'self'; style-src 'self' 'unsafe-inline'"
csp += "; default-src 'self'; img-src 'self' data:; media-src 'self' https://upload.wikimedia.org; connect-src 'self' https://*.wikipedia.org https://www.wikidata.org https://commons.wikimedia.org https://upload.wikimedia.org https://collectionapi.metmuseum.org https://images.metmuseum.org; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; form-action 'self'"
# Cloudflare serves build/ as static assets and applies these rules; the file itself is not served.
(built / '_headers').write_text(f"""/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  Content-Security-Policy: {csp}

/_app/immutable/*
  Cache-Control: public, max-age=31536000, immutable
""")
print('Built release', release, 'with', len(files) + 2, 'files in build/')
