# 紫色的蛋 · 行程备忘

一个极简的 Android 行程 / 待办备忘 App：本地存储、不联网、无广告，界面为紫粉配色，
图标是一只 Q 版紫色的蛋。

- 包名：`com.purpleegg.app`
- 版本：`1.0.0`（versionCode 1）
- 支持系统：Android 7.0（API 24）及以上
- 技术栈：WebView 外壳（Java）+ 纯 HTML/CSS/JS 界面（`app/src/main/assets/`）

更新历史见 [CHANGELOG.md](CHANGELOG.md)。

## 功能

- **时间轴**（08:00–22:00，两小时一格）
  - 有开始 + 有结束 → 彩色方块，高度等于时长；时间重叠时逐层向右错开。
  - 只有开始 或 只有结束 → 彩色横线，同时进左下角圆点清单。
  - 落在 22:00–08:00 的事不进时间轴，收进左下角圆点清单。
  - 起止都没填 → 归到「待安排」。
- **日期条**：70 天可横向滑动，跨月 / 跨年自动标注；每格下方的小圆点 = 那天还没做完的事。
- **添加 / 编辑任务**：标题、备注、开始、结束、提醒、重要、颜色一屏填完。
- **提醒**：9 个常用档位 + 自定义（分钟 / 小时 / 天），存储值统一是「提前多少分钟」。
- **重要事件**：给任务打星标，右上角「接下来」抽屉看最近三件 + 重要事件。
- **自建控件**：24 小时制时间拨轮、自建月历（有安排的日期带小点），不调用系统弹窗。
- **备份**：导入 / 导出 JSON 文本，方便换机迁移。
- **数据只存在手机本地**：App 无网络权限，不上传、不采集任何数据。

## 目录

```
.
├── app/                 # Android 应用模块（源码）
│   └── src/main/
│       ├── assets/      # 界面：index.html / app.css / app.js / store.js
│       ├── java/com/purpleegg/app/   # WebView 外壳 + 提醒调度
│       └── res/         # 图标、颜色、主题、文案
├── tools/
│   ├── setup-toolchain.mjs    # 下载并就位 JDK17 + Android SDK + Gradle
│   ├── build-apk.ps1          # 一键构建 + 签名 + 校验
│   ├── make-icons.ps1         # 生成 Q 版紫蛋图标
│   ├── preview-server.mjs     # 本地预览 assets 界面
│   └── apk-server.mjs         # 局域网下载口（把 APK 装到手机）
└── settings.gradle.kts
```

## 构建

首次构建先准备本地工具链（下载到 `.toolchain/`，不提交进 Git）：

```powershell
node tools/setup-toolchain.mjs
```

然后一键构建（自动生成签名密钥并写入 `keystore.properties`，两者都不提交）：

```powershell
powershell -ExecutionPolicy Bypass -File tools\build-apk.ps1
```

产物：`紫色的蛋-v1.0.0.apk`（仓库根目录）。

签名密钥在首次构建时随机生成并保存在 `keystore/purpleegg.jks`；换机器后首次构建会重新生成，
因此**覆盖安装必须用同一份 keystore**，请自行备份 `keystore/` 目录。

## 在电脑上预览界面

```powershell
node tools\preview-server.mjs
# 浏览器打开 http://127.0.0.1:8899/index.html
#   加参数可看不同状态：?demo=1（示例数据）、?tp=08:30（时间拨轮）、
#   ?dp=2026-10-20（月历）、?rm=30（提醒弹层）、?new=1（新任务表单）
```

## 说明

- 自签名 APK，用于个人自用，不能上架应用商店。
- App 只申请通知、闹钟、开机自启、震动四个权限；没有网络与定位权限。
