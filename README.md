# BgmDownloaderWindows

本项目是 [BgmDownloaderV5](https://github.com/MSTAT-Lseng/BgmDownloaderV5) 的 **Electron 版本**，
面向 Windows 平台。功能与原 App 保持一致。

## 功能

| 移动端（Expo） | 桌面版（Electron） |
| --- | --- |
| `expo-router` 文件路由 | `src/renderer/src/navigation.tsx` 内的轻量导航栈 |
| `react-native-webview` | `WebContentsView`（`src/main/webview-controller.ts`） |
| `expo-sqlite` 收藏库 | `better-sqlite3`（`src/main/favorites-db.ts`），表结构与原版一致 |
| `@react-native-async-storage/async-storage` | `userData/settings.json`（`src/main/settings-store.ts`） |
| `Alert` / `Modal` / Toast | `dialog`、应用内 `prompt` / `confirm`、Toast 组件 |
| `Linking.openURL` | `shell.openExternal` |
| 注入脚本隐藏广告 | 同样注入 `resources/sources/config_scripts.js.txt`，每 2 秒重注入一次 |
| 播放页域外跳转拦截 | `will-navigate` + `will-redirect` + `setWindowOpenHandler` 三重守卫 |

## 目录结构

```
.
├─ electron.vite.config.ts    electron-vite 构建配置（main / preload / renderer）
├─ electron-builder.yml       打包配置（NSIS 安装包 + 免安装单文件）
├─ build/icon.ico             应用图标（多尺寸 ICO）
├─ resources/                 运行期资源：站点索引、搜索配置、注入脚本、图标、字体
│  ├─ sources/index.json      站点列表（名称 / 地址 / 是否启用 / 是否适配搜索）
│  ├─ sources/config_*.json   各站点搜索配置（URL 模板 + 结果正则）
│  ├─ sources/*.js.txt        页面净化脚本与全屏监听脚本
│  ├─ icons/sources/*.png     站点图标
│  └─ fonts/Ionicons.ttf      Ionicons 图标字体
└─ src/
   ├─ main/                   主进程：窗口、IPC、SQLite、设置、更新检查、内嵌浏览器
   ├─ preload/                contextBridge 暴露的受限 API
   ├─ shared/                 主进程与渲染进程共享的类型与 IPC 通道名
   └─ renderer/               React 界面
```

## 开发

```bash
npm install
npm run dev          # 启动开发模式（HMR）
```

> 首次安装如果卡在下载 Electron 二进制，可先设置镜像：
> `set ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/`

## 构建

```bash
npm run typecheck    # 主进程 + 渲染进程类型检查
npm run build        # 编译到 out/
npm run dist         # 生成安装包与免安装版到 release/
```

产物：

- `release/番剧下载-<版本>-x64.exe`：NSIS 安装包（可选安装目录、创建桌面/开始菜单快捷方式）
- `release/番剧下载-<版本>-portable.exe`：免安装单文件，双击即用

## 数据存放位置

| 内容 | 路径 |
| --- | --- |
| 收藏数据库 | `%APPDATA%\番剧下载\app.db`（SQLite，WAL 模式） |
| 应用设置 | `%APPDATA%\番剧下载\settings.json` |
| 浏览器缓存 / Cookie | `%APPDATA%\番剧下载\Network`、`Cache` 等 |

卸载安装版时默认保留上述数据（`deleteAppDataOnUninstall: false`），重新安装后收藏仍在。
如需彻底清理，手动删除 `%APPDATA%\番剧下载` 即可。

## 实现要点

### 内嵌浏览器

第三方站点页面放在 `WebContentsView` 里，叠在渲染进程窗口的指定区域之上，
位置由渲染进程用 `ResizeObserver` 测量 `.webview-container` 后通过 IPC 同步给主进程。
这样页面内容与 React 界面互不干扰，同时站点页面本身以 `sandbox: true` 运行，拿不到 Node 能力。

### 聚合搜索

原版里 React Native 的 `fetch` 不受浏览器同源策略限制。在 Electron 渲染进程中直接 `fetch`
会被 CORS 拦下，因此搜索请求统一走主进程的 `net.fetch`：

- 走 Chromium 的网络与证书栈，和站点在浏览器里打开时的行为一致；
  用 Node 自带的 `fetch` 会在部分证书链不完整的站点上直接失败。
- 可自由设置 `User-Agent`、`Cookie`、`apikey` 等请求头（次元城、稀饭动漫、girigiri 各自有特殊要求）。

随后用各站点 `config_<id>.json` 里的 `item_regex` 解析结果，逻辑与原版一致。

### 播放页跳转拦截

`player` 模式只放行：

1. 白名单域名（`xgct.com/video`、`xgcartoon.com/`）；
2. 与初始地址 **同主域** 的页面。

同主域判断按「去掉 www / 数字前缀后比较后两段」实现，
这样 `502.girigirilove.com` 这类播放源子域不会被误杀，而广告与第三方站点会被拦下。

### 收藏

渲染进程负责弹出命名对话框，写库与状态同步统一交给主进程的 `webview.setFavorite()`（幂等），
避免「先写库再切换」导致状态被取反。顶栏星标在每次导航后都会按数据库重新校准。

## 已知限制

- 部分站点限制访问地区（例如次元城、AGE动漫标注「仅限国内IP」），在受限网络下会显示站点自己的提示页，属于站点行为。
- 少数站点会周期性改动页面结构，导致搜索正则失配；此时只需更新 `resources/sources/config_<id>.json`，无需改代码。
- 未做代码签名，首次运行时 Windows SmartScreen 可能提示「已保护你的电脑」，选择「更多信息 → 仍要运行」即可。
