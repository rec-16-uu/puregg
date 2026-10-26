// 紫色的蛋 · 局域网下载口（只暴露 APK 与一个说明页，供手机浏览器直接把安装包装到手机）
// 用法：在项目根目录下执行  node tools\apk-server.mjs
// 注意：APK 路径在启动时读定 —— 换了版本号要重启这个进程，否则发出去的还是旧包。
import { createServer } from 'node:http'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const APK = join(root, String.fromCharCode(0x7d2b, 0x8272, 0x7684, 0x86cb) + '-v1.0.0.apk')  // 紫色的蛋-v1.0.0.apk
const PORT = Number(process.env.PORT || 8900)

let apkKB = 0
let apkVer = ''
let apkSha = ''
try {
  apkKB = Math.round(statSync(APK).size / 1024)
  const m = /-v([0-9.]+)\.apk$/.exec(APK)
  apkVer = m ? m[1] : ''
  apkSha = createHash('sha256').update(readFileSync(APK)).digest('hex').slice(0, 16).toUpperCase()
} catch (e) { /* 包还没打出来时页面照样能开 */ }

const PAGE = `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>紫色的蛋 ${apkVer}</title>
<style>
  :root{--accent:#6D4AFF;--ink:#221C2E;--muted:#7A7387;--faint:#A9A2B6;
        --line:rgba(34,28,46,.10);--line2:rgba(34,28,46,.055)}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  /* 点一下不要那圈系统蓝框 */
  a:focus,a:focus-visible,button:focus{outline:none}
  html,body{margin:0;min-height:100%}
  body{background:#F5F4F7;color:var(--ink);font-size:15px;line-height:1.6;
       font-family:-apple-system,"HarmonyOS Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;
       display:flex;justify-content:center;padding:calc(28px + env(safe-area-inset-top)) 18px calc(28px + env(safe-area-inset-bottom));
       -webkit-font-smoothing:antialiased}
  .wrap{width:100%;max-width:392px}
  .top{display:flex;align-items:center;gap:11px;margin:0 2px 16px}
  .top svg{flex:0 0 auto;display:block}
  .top h1{margin:0;font-size:19px;font-weight:600;letter-spacing:5px}
  .top p{margin:2px 0 0;color:var(--muted);font-size:12px;letter-spacing:.3px}
  .card{background:#fff;border:1px solid var(--line);border-radius:20px;
        box-shadow:0 1px 2px rgba(24,18,38,.04)}
  .rows{padding:4px 18px}
  .row{display:flex;justify-content:space-between;gap:12px;padding:11px 0;font-size:13.5px}
  .row + .row{border-top:1px solid var(--line2)}
  .row span{color:var(--muted);font-size:12.5px}
  .row b{font-weight:600;font-variant-numeric:tabular-nums;text-align:right;word-break:break-all}
  .dl{display:block;margin:2px 18px 18px;padding:15px;border-radius:14px;background:var(--accent);
      color:#fff;text-decoration:none;text-align:center;font-size:16px;font-weight:600;letter-spacing:.5px}
  .dl:active{filter:brightness(.95)}
  .dl small{display:block;font-size:11.5px;font-weight:400;color:rgba(255,255,255,.8);letter-spacing:.3px;margin-top:3px}
  .steps{margin:22px 2px 0;padding:0;list-style:none;counter-reset:s}
  .steps li{position:relative;padding:0 0 14px 30px;font-size:13.5px;color:#4A4356}
  .steps li::before{counter-increment:s;content:counter(s);position:absolute;left:0;top:1px;
      width:20px;height:20px;border:1px solid var(--line);border-radius:50%;background:#fff;
      color:var(--muted);font-size:11.5px;line-height:19px;text-align:center}
  .foot{margin:20px 2px 0;padding-top:14px;border-top:1px solid var(--line);color:var(--faint);font-size:11.5px;line-height:1.8}
  .foot code{font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--muted);letter-spacing:.2px}
</style></head>
<body><div class="wrap">
  <div class="top">
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect x="4.5" y="6.5" width="25" height="23" rx="6" stroke="#6D4AFF" stroke-width="1.6"/>
      <path d="M4.5 13.5h25" stroke="#6D4AFF" stroke-width="1.6"/>
      <path d="M11 4.5v4M23 4.5v4" stroke="#6D4AFF" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="17" cy="21" r="3" fill="#6D4AFF"/>
    </svg>
    <div><h1>紫色的蛋</h1><p>行程备忘 · 提醒</p></div>
  </div>

  <div class="card">
    <div class="rows">
      <div class="row"><span>版本</span><b>${apkVer || '—'}</b></div>
      <div class="row"><span>大小</span><b>${apkKB ? apkKB + ' KB' : '未打包'}</b></div>
      <div class="row"><span>包名</span><b>com.purpleegg.app</b></div>
      <div class="row"><span>系统</span><b>Android 7.0 及以上</b></div>
    </div>
    <a class="dl" href="/apk">下载安装包<small>点一下开始下载</small></a>
  </div>

  <ol class="steps">
    <li>点上面的按钮，下载到手机。</li>
    <li>打开下载好的文件，允许「未知来源」安装。</li>
    <li>直接覆盖安装：同一个签名，任务都留着。</li>
  </ol>

  <div class="foot">
    签名与旧版一致，可覆盖安装。SHA-256 前 16 位 <code>${apkSha || '——'}</code><br>
    只在这台电脑上跑，不联网、不采集任何数据。
  </div>
</div></body></html>`

createServer((req, res) => {
  const url = (req.url || '/').split('?')[0]
  if (url === '/apk' || url.endsWith('.apk')) {
    let size = 0
    try { size = statSync(APK).size } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('APK 不存在：' + APK)
      return
    }
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(size),
      'Content-Disposition': 'attachment; filename="purpleegg-v' + (apkVer || '1.0.0') + '.apk"',
      'Cache-Control': 'no-store',
    })
    createReadStream(APK).pipe(res)
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE)
}).listen(PORT, '0.0.0.0', () => {
  const ips = []
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) ips.push(ni.address)
    }
  }
  console.log('APK : ' + APK)
  for (const ip of ips) console.log('手机浏览器打开:  http://' + ip + ':' + PORT + '/')
})
