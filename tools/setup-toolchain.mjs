// 紫色的蛋 · 工具链安装（下载 + 解包 + 就位）
// 用法: node tools/setup-toolchain.mjs
// 结果: .toolchain/{jdk17,gradle-8.7,android-sdk/{platforms/android-34,build-tools/34.0.0,platform-tools,licenses}}
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const TC = join(root, '.toolchain')
const DL = join(TC, 'downloads')
const SDK = join(TC, 'android-sdk')
mkdirSync(DL, { recursive: true })

const ITEMS = [
  { file: 'jdk17.zip', size: 182.0, urls: ['https://mirrors.tuna.tsinghua.edu.cn/Adoptium/17/jdk/x64/windows/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip'] },
  { file: 'gradle-8.7-bin.zip', size: 131.0, urls: ['https://mirrors.cloud.tencent.com/gradle/gradle-8.7-bin.zip', 'https://services.gradle.org/distributions/gradle-8.7-bin.zip'] },
  { file: 'platform-34.zip', size: 60.3, urls: ['https://dl.google.com/android/repository/platform-34-ext7_r03.zip'] },
  { file: 'build-tools-34.zip', size: 55.6, urls: ['https://dl.google.com/android/repository/build-tools_r34-windows.zip'] },
  { file: 'platform-tools.zip', size: 7.7, urls: ['https://dl.google.com/android/repository/platform-tools_r37.0.1-win.zip'] },
]

const MB = 1048576

/** zip 完整性：能列出目录即可 */
function zipOk(file) {
  const r = spawnSync('tar', ['-tf', file], { stdio: ['ignore', 'ignore', 'ignore'] })
  return r.status === 0
}

async function download(item) {
  const dest = join(DL, item.file)
  if (existsSync(dest) && zipOk(dest)) { console.log(`[已就绪] ${item.file} ${(statSync(dest).size / MB).toFixed(1)}MB`); return true }
  if (existsSync(dest)) { console.log(`[损坏] ${item.file}，重新下载`); rmSync(dest, { force: true }) }
  for (let attempt = 1; attempt <= 6; attempt++) {
    let have = existsSync(dest) ? statSync(dest).size : 0
    const url = item.urls[Math.min(attempt - 1, item.urls.length - 1)] || item.urls[0]
    try {
      const headers = have > 0 ? { Range: `bytes=${have}-` } : {}
      const res = await fetch(url, { headers, redirect: 'follow' })
      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)
      if (res.status !== 206) have = 0
      const declared = Number(res.headers.get('content-length') || 0) + have
      const ws = createWriteStream(dest, { flags: have > 0 ? 'r+' : 'w', start: have })
      let got = have
      let last = 0
      const reader = res.body.getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          got += value.length
          if (!ws.write(Buffer.from(value))) await new Promise((r) => ws.once('drain', r))
          const now = Date.now()
          if (now - last > 1500) {
            last = now
            process.stdout.write(`\r  ${item.file}  ${(got / MB).toFixed(1)}/${declared ? (declared / MB).toFixed(1) : '?'}MB  ${declared ? ((got / declared) * 100).toFixed(0) + '%' : ''}    `)
          }
        }
      } finally { await new Promise((r) => ws.end(r)) }
      const size = statSync(dest).size
      // 流正常结束即视为下完；再用 zip 完整性兜底
      if (size >= declared || (!declared && size > 0)) {
        if (zipOk(dest)) { console.log(`\n[完成] ${item.file} ${(size / MB).toFixed(1)}MB`); return true }
        console.log(`\n[校验失败] ${item.file} ${(size / MB).toFixed(1)}MB，重下`)
        rmSync(dest, { force: true })
        continue
      }
      console.log(`\n[不完整] ${item.file} ${(size / MB).toFixed(1)}MB，续传重试`)
    } catch (e) {
      console.log(`\n[失败 ${attempt}/6] ${item.file}: ${e.message}`)
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  return false
}

function tar(args) {
  const r = spawnSync('tar', args, { stdio: 'inherit' })
  if (r.status !== 0) throw new Error('tar 解包失败: ' + args.join(' '))
}

/** 解包到临时目录，把唯一的顶层目录移动到 target */
function extractInto(zipFile, target, innerName) {
  if (existsSync(join(target, 'source.properties')) || existsSync(join(target, 'bin'))) {
    console.log(`[已是目标结构] ${target}`)
    return
  }
  const tmp = join(TC, 'tmp-' + Date.now())
  mkdirSync(tmp, { recursive: true })
  console.log(`[解包] ${zipFile} -> ${tmp}`)
  tar(['-xf', join(DL, zipFile), '-C', tmp])
  const entries = readdirSync(tmp)
  let src = tmp
  if (innerName) src = join(tmp, innerName)
  else if (entries.length === 1 && statSync(join(tmp, entries[0])).isDirectory()) src = join(tmp, entries[0])
  rmSync(target, { recursive: true, force: true })
  mkdirSync(dirname(target), { recursive: true })
  renameSync(src, target)
  rmSync(tmp, { recursive: true, force: true })
  console.log(`[就位] ${target}`)
}

for (const item of ITEMS) {
  const ok = await download(item)
  if (!ok) { console.log(`[中止] ${item.file} 下载失败`); process.exit(1) }
}

extractInto('jdk17.zip', join(TC, 'jdk17'))
extractInto('gradle-8.7-bin.zip', join(TC, 'gradle-8.7'))
extractInto('platform-34.zip', join(SDK, 'platforms', 'android-34'))
extractInto('build-tools-34.zip', join(SDK, 'build-tools', '34.0.0'))
extractInto('platform-tools.zip', join(SDK, 'platform-tools'))

// AGP 的 license 校验
mkdirSync(join(SDK, 'licenses'), { recursive: true })
writeFileSync(join(SDK, 'licenses', 'android-sdk-license'), '24333f8a63b6825ea9c5514f83c2829b004d1fee\n8933bad161af4178b1185d1a37fbf41ea5269c55\nd56f5187479451eabf01fb78af6dfcb131a6481e\n')
writeFileSync(join(SDK, 'licenses', 'android-sdk-preview-license'), '84831b9409646a918e30573bab4c9c91346d8abd\n')

// 自检
const checks = [
  [join(TC, 'jdk17', 'bin', 'java.exe'), 'JDK java'],
  [join(TC, 'jdk17', 'bin', 'javac.exe'), 'JDK javac'],
  [join(TC, 'jdk17', 'bin', 'keytool.exe'), 'JDK keytool'],
  [join(TC, 'gradle-8.7', 'bin', 'gradle.bat'), 'Gradle'],
  [join(SDK, 'platforms', 'android-34', 'android.jar'), 'android.jar'],
  [join(SDK, 'build-tools', '34.0.0', 'aapt2.exe'), 'aapt2'],
  [join(SDK, 'build-tools', '34.0.0', 'd8.bat'), 'd8'],
  [join(SDK, 'build-tools', '34.0.0', 'zipalign.exe'), 'zipalign'],
  [join(SDK, 'build-tools', '34.0.0', 'apksigner.bat'), 'apksigner'],
]
console.log('\n===== 自检 =====')
let bad = 0
for (const [p, label] of checks) {
  const ok = existsSync(p)
  if (!ok) bad++
  console.log(`${ok ? 'OK  ' : '缺失'}  ${label}  ${p}`)
}
console.log(bad === 0 ? '\n[工具链就绪]' : `\n[缺 ${bad} 项]`)
process.exitCode = bad === 0 ? 0 : 2
