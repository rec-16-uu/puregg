// 紫色的蛋 · 工具链下载器（Node 24）
// 用法: node tools/download-toolchain.mjs
// 输出: .toolchain/downloads/*.zip
import { createWriteStream, existsSync, mkdirSync, statSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = join(root, '.toolchain', 'downloads')
mkdirSync(outDir, { recursive: true })

const ITEMS = [
  {
    name: 'JDK 17 (Temurin, 清华镜像)',
    file: 'jdk17.zip',
    url: 'https://mirrors.tuna.tsinghua.edu.cn/Adoptium/17/jdk/x64/windows/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip',
  },
  {
    name: 'Android command-line tools (Google)',
    file: 'cmdline-tools.zip',
    url: 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip',
  },
  {
    name: 'Gradle 8.7 (腾讯镜像)',
    file: 'gradle-8.7-bin.zip',
    url: 'https://mirrors.cloud.tencent.com/gradle/gradle-8.7-bin.zip',
    fallback: 'https://services.gradle.org/distributions/gradle-8.7-bin.zip',
  },
]

async function fetchToFile(url, dest) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const total = Number(res.headers.get('content-length') || 0)
  let got = 0
  let lastPrint = 0
  const ws = createWriteStream(dest)
  const reader = res.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      got += value.length
      if (!ws.write(Buffer.from(value))) await new Promise((r) => ws.once('drain', r))
      const now = Date.now()
      if (now - lastPrint > 1500) {
        lastPrint = now
        const pct = total ? ((got / total) * 100).toFixed(1) + '%' : '?'
        process.stdout.write(`\r  ${(got / 1048576).toFixed(1)}MB / ${(total / 1048576).toFixed(1)}MB  ${pct}   `)
      }
    }
  } finally {
    await new Promise((r) => ws.end(r))
  }
  return got
}

for (const item of ITEMS) {
  const dest = join(outDir, item.file)
  if (existsSync(dest) && statSync(dest).size > 1024 * 1024) {
    console.log(`[skip] ${item.name} 已存在 (${(statSync(dest).size / 1048576).toFixed(1)}MB)`)
    continue
  }
  console.log(`[下载] ${item.name}`)
  const urls = [item.url, ...(item.fallback ? [item.fallback] : [])]
  let ok = false
  for (const u of urls) {
    try {
      const n = await fetchToFile(u, dest)
      console.log(`\n[完成] ${item.file}  ${(n / 1048576).toFixed(1)}MB`)
      ok = true
      break
    } catch (e) {
      console.log(`\n[失败] ${u}\n       ${e.message}`)
      try { rmSync(dest, { force: true }) } catch {}
    }
  }
  if (!ok) { console.log(`[中止] ${item.name} 所有源均失败`); process.exitCode = 1; break }
}
console.log('[全部结束]')
