# AGENTS.md

This file provides guidance to Qoder (lingma.aliyun.com) when working with code in this repository.

## 项目概述

局域网音乐分享平台 — Node.js + Express 5 后端，纯 HTML/CSS/JS 前端（无框架），SQLite 数据库。CommonJS 模块系统。

## 常用命令

```bash
# 开发模式（热重载，仅 Windows）
npm run dev

# 生产模式
npm start

# 语法检查（替代 lint）
node --check app.js
node --check src/**/*.js

# 测试 — 当前无测试框架，仅占位
npm test
```

注意：`npm run dev` 使用 Windows 专属的 `set NODE_ENV=development`，在 Unix 系统上需要改为 `NODE_ENV=development nodemon app.js`。

## 核心架构

### 启动流程

```
加载 .env → 初始化 Express (CORS/BodyParser/Session/CSP) → 挂载路由
→ 启动 HTTP 服务 (0.0.0.0:3000) → 初始化 SQLite 数据库
→ 增量扫描 music/ 目录 → 就绪
```

`app.js` 是唯一入口，没有分层或依赖注入容器。

### 数据库层 (`src/utils/database.js`)

- SQLite 单文件 `music.db`，使用 `sqlite3` npm 包（回调风格）
- 导出**单例** `database` 实例
- 所有方法返回 Promise（内部封装了 sqlite3 的回调）
- 支持事务性批量操作：`batchAddMusic()` / `batchUpdateMusic()` / `deleteNonExistentFiles()`
- 表结构见 `database.js` 中的 `CREATE TABLE music`

### 音乐扫描器 (`src/utils/scanner.js`)

`MusicScanner` 类实现增量扫描：比较文件系统与数据库记录，识别新增/修改/删除，每批 10 个文件处理。扫描状态通过 `getScanStatus()` 主动轮询，无 WebSocket 推送。

关键设计：扫描是异步后台进程，通过 `isScanning` 标志位和 `currentScanId` 支持取消。

### 认证机制

- `express-session` 内存存储，1 小时过期
- 用户凭据硬编码在 `src/routes/auth.js`（admin/admin）
- `src/middleware/auth.js` 提供两种中间件：
  - `authMiddleware`：未登录重定向到 `/login`
  - `apiAuthMiddleware`：未登录返回 401 JSON
- `GET /auth/logout`（新增）和 `POST /auth/logout`（原有）共存

### 前端

- SPA 架构，`public/index.html` + `public/js/app.js`
- Bootstrap 5.3 + Font Awesome 6（CDN 加载）
- CSP 白名单允许 `cdn.jsdelivr.net` 和 `cdnjs.cloudflare.com`
- `escapeHtml()` 工具函数用于 XSS 防护，所有 `innerHTML` 赋值必须包裹用户数据

### API 设计

所有 API 路由挂载在 `/api` 下，文件流媒体在 `/music/file/:filename`。

- `GET /api/music/list` — 全量列表
- `GET /api/music/play/:id` — 返回播放 URL
- `GET /api/music/cover/:id` — 无需认证（通过 `fs.createReadStream` 直接传输）
- `POST /api/music/upload` — multer 处理，限制 `.mp3` / `.flac`，100MB
- `DELETE /api/music/:id` — 同时删除数据库记录和文件
- `GET /api/music/search?q=` — LIKE 搜索标题/艺术家/专辑
- `POST /api/music/rescan` — 触发增量扫描
- `GET /api/music/scan-status` / `POST /api/music/scan-stop` — 扫描控制

## 需要注意的陷阱

1. **EJS 视图引擎已配置但 `views/` 目录不存在** — 所有 HTML 作为静态文件从 `public/` 提供，`app.set('view engine', 'html')` 和 EJS 的 `renderFile` 目前未使用。

2. **封面路径使用相对路径格式 `/covers/...`** — 数据库和扫码器都存储相对路径（如 `/covers/abc_cover.png`），不要使用绝对路径。

3. **`src/routes/music.js` 包含路径遍历防护** — 拒绝含 `..`、`/`、`\` 的文件名。修改此逻辑时需保持防护。

4. **Windows 开发环境** — npm scripts 使用 `set` 语法，跨平台时需注意。

5. **没有构建/打包环节** — 前端直接写原生 JS/CSS，没有 webpack/vite 等工具链。

6. **测试文件被 .gitignore 排除** — 根目录的 `test*.html` 和 `test*.js` 不会被提交。

7. **`music-metadata` 库提取封面** — 封面文件以 `{id}_cover.{format}` 命名，存储在 `public/covers/`。LSB 分支中的 `extractCover()` 可能会提取出 `.imagepng` 等非标准扩展名格式。

## 项目配置

- 缩进：4 空格（JSON 和 YAML 为 2 空格）
- 换行符：LF
- 编码：UTF-8
- 语言：中文（UI + 注释）
