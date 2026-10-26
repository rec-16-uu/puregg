// 紫色的蛋 · 本地预览服务（仅开发用；把 assets 目录挂在 http://127.0.0.1:8899/）
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(resolve(here, '..'), 'app', 'src', 'main', 'assets')
const PORT = Number(process.env.PORT || 8899)

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' }

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0])
    if (p === '/') p = '/index.html'
    const file = normalize(join(root, p))
    if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return }
    await stat(file)
    const buf = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    res.end(buf)
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 ' + e.message)
  }
}).listen(PORT, '127.0.0.1', () => console.log('preview: http://127.0.0.1:' + PORT + '/index.html  (root=' + root + ')'))
