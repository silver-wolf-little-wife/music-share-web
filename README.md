# Music Share Web

局域网音乐分享平台 — 在浏览器中浏览、播放和管理你的音乐收藏。

## 功能

### 音乐库管理
- **自动扫描** — 增量扫描本地音乐目录，提取 MP3/FLAC 元数据（标题、艺术家、专辑、封面）
- **歌曲统计** — 首页显示歌曲总数、总大小、总时长、格式分布
- **文件上传** — Web 界面拖拽上传，自动解析 ID3v2/Vorbis 元数据、内嵌封面和歌词
- **搜索** — 按标题、艺术家或专辑搜索音乐库

### 在线播放
- **流媒体播放** — 支持 HTTP Range 请求（206 Partial Content），可拖拽进度条任意位置播放
- **网易云风格详情页** — 全屏播放页，含黑胶唱片+唱针动画、模糊背景、LRC 歌词同步滚动
- **双音频预加载** — 当前歌曲开始播放后自动预加载下一首音轨和封面，切换歌曲时直接交换 Audio 元素，零等待
- **四种播放模式** — 顺序播放、随机播放（带历史回退）、单曲循环、列表循环
- **首页预加载** — 列表加载后立即预加载第一首歌，消除首播延迟

### 内嵌歌词
- **多格式兼容** — 自动解析 MP3 ID3v2 USLT 帧和 FLAC Vorbis LYRICS 字段
- **LRC 时间轴同步** — 实时高亮当前行并自动滚动，支持翻译行检测（连续相同时间戳）
- **按需加载** — 歌词独立 API 端点，列表接口不含歌词数据以减少传输量

### 视图与交互
- **列表/网格切换** — 两种音乐展示模式，一键切换
- **中英文切换** — 界面语言实时切换
- **侧滑面板** — 歌词面板和播放列表面板从右侧滑入
- **扫描进度** — 增量扫描进度条实时显示，支持取消扫描
- **错误日志** — 扫描错误持久化到 `logs/scan-errors.log`，结构化 JSON 行格式

### 安全
- **Session 认证** — 基于 express-session 的登录保护，API 和页面分别鉴权
- **路径遍历防护** — 文件流媒体和封面端点均拒绝含 `..`、`/`、`\` 的路径
- **CSP 安全头** — 内容安全策略限制脚本/样式/字体来源
- **XSS 防护** — 所有用户数据输出经过 `escapeHtml()` 转义

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express 5 (CommonJS) |
| 数据库 | SQLite (sqlite3, WAL 模式) |
| 前端 | 原生 HTML/CSS/JS + Bootstrap 5.3 + Font Awesome 6 |
| 元数据 | music-metadata |
| 文件上传 | multer |
| 响应压缩 | compression (gzip) |
| 测试 | Jest + supertest |

## 项目结构

```
music-share-web/
├── app.js                  # 应用入口
├── package.json
├── start.bat               # Windows 一键启动脚本
├── start.ps1               # PowerShell 启动脚本
├── Dockerfile
├── docker-compose.yml
├── src/
│   ├── middleware/
│   │   ├── auth.js         # 认证中间件（页面重定向 + API 401）
│   │   └── csp.js          # CSP 安全头
│   ├── routes/
│   │   ├── api.js          # /api 路由（列表、播放、歌词、封面、上传、搜索、扫描）
│   │   ├── auth.js         # /auth 路由（登录/登出）
│   │   └── music.js        # /music 路由（流媒体，支持 Range + ETag 缓存）
│   └── utils/
│       ├── database.js     # SQLite 数据库单例（含二级缓存）
│       ├── logger.js       # 错误日志持久化
│       ├── metadata.js     # 音乐元数据提取（含内嵌歌词多源解析）
│       └── scanner.js      # 增量文件扫描器
├── public/
│   ├── index.html          # 主页面（SPA）
│   ├── login.html          # 登录页面
│   ├── css/style.css
│   ├── js/app.js
│   └── covers/             # 提取的封面图片（运行时生成）
├── tests/                  # Jest 测试用例（16 个，4 个套件）
├── logs/                   # 扫描错误日志
├── music/                  # 音乐文件存放目录
└── data/                   # SQLite 数据库文件
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装

```bash
git clone https://github.com/silver-wolf-little-wife/music-share-web.git
cd music-share-web
npm install
```

### 配置

创建 `.env` 文件（可选，所有变量均有默认值）：

```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=your-secret-key-here
DB_PATH=data/music.db
```

### 运行

```bash
# 生产模式
npm start

# 开发模式（热重载，Windows）
npm run dev

# Windows 用户也可以双击运行
start.bat     # CMD
start.ps1     # PowerShell
```

启动后访问 `http://localhost:3000`，默认凭据 `admin` / `admin`。

## API 接口

所有 `/api` 路由需要登录认证（Session Cookie），封面和文件流媒体端点除外。

### 音乐 API

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/music/list` | 是 | 获取音乐列表（不含歌词，已缓存） |
| GET | `/api/music/stats` | 是 | 歌曲统计（总数/大小/时长/格式分布） |
| GET | `/api/music/play/:id` | 是 | 获取播放 URL |
| GET | `/api/music/lyrics/:id` | 是 | 获取歌词文本（按需加载） |
| GET | `/api/music/cover/:id` | 否 | 获取封面图片（含 24h 缓存头） |
| GET | `/api/music/search?q=` | 是 | 搜索音乐（标题/艺术家/专辑） |
| POST | `/api/music/upload` | 是 | 上传音乐文件（MP3/FLAC，限 100MB） |
| DELETE | `/api/music/:id` | 是 | 删除音乐（文件 + 封面 + 数据库记录） |

### 扫描管理

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/music/rescan` | 是 | 触发增量扫描，返回 scanId |
| GET | `/api/music/scan-status` | 是 | 查询扫描进度（isScanning / progress% / 结果） |
| POST | `/api/music/scan-stop` | 是 | 取消正在进行的扫描 |

### 文件流媒体

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/music/file?name=<filename>` | 否 | 流媒体播放，支持 Range 请求和 ETag 缓存 |

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 登录（username/password），返回 JSON |
| POST | `/auth/logout` | 登出，返回 JSON |
| GET | `/auth/logout` | 登出，重定向到 /login |
| GET | `/auth/user` | 获取当前用户信息 |

## 性能优化

| 优化项 | 说明 |
|--------|------|
| **gzip 压缩** | 所有 text/JSON 响应体积减少 65-80% |
| **歌词按需加载** | 列表 API 不含 `lyrics` 字段，打开歌词面板时才获取 |
| **双音频预加载** | 播放当前歌曲时自动预加载下一首，切换零延迟 |
| **首页预加载** | 列表加载后立即预加载第一首歌 |
| **HTTP 缓存** | 音频流 ETag + 304 响应；封面 24 小时浏览器缓存 |
| **音乐列表缓存** | 内存缓存列表数据，写操作后自动失效 |
| **文件元数据缓存** | 内存 Map 缓存文件名→size/mtime，消除 fs.statSync 磁盘 I/O |
| **WAL 模式** | SQLite WAL 模式 + synchronous=NORMAL，提升并发读写性能 |
| **启动预初始化** | 数据库和缓存完全就绪后才开始接受请求 |

## 测试

```bash
npm test
```

覆盖范围：

| 套件 | 测试项 |
|------|--------|
| `database.test.js` | 统计查询、聚合函数、结果结构 |
| `logger.test.js` | 单条写入、批量写入、目录自动创建 |
| `scanner.test.js` | 错误收集、降级处理、日志持久化 |
| `api.test.js` | Stats API 正常/异常/空库响应 |

## Docker 部署

### 使用 docker-compose（推荐）

```bash
docker-compose up -d
```

### 直接使用 Docker

```bash
docker run -d --name music-share --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/music:/app/music \
  -v /path/to/covers:/app/public/covers \
  -v /path/to/data:/app/data \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DB_PATH=/app/data/music.db \
  -e SESSION_SECRET=change-this-to-a-random-string \
  crpi-1txugqp0dkatkk3t.cn-shanghai.personal.cr.aliyuncs.com/chengxiyue/music-share-web:latest
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `NODE_ENV` | `production` | 环境模式（`development` 启用详细日志） |
| `SESSION_SECRET` | `music-share-secret-key` | Session 加密密钥 |
| `DB_PATH` | `data/music.db` | SQLite 数据库路径（Docker 下建议映射到 `/app/data/music.db`） |

### CI/CD

每次推送 `master` 分支自动触发 GitHub Actions 构建 Docker 镜像，推送至 GitHub Container Registry (`ghcr.io`) 和阿里云容器镜像仓库。

## 数据库结构

```sql
CREATE TABLE music (
    id          TEXT PRIMARY KEY,   -- 文件名（不含路径）
    filename    TEXT NOT NULL,      -- 文件名
    title       TEXT,               -- 标题
    artist      TEXT,               -- 艺术家
    album       TEXT,               -- 专辑
    year        INTEGER,            -- 年份
    genre       TEXT,               -- 流派
    duration    REAL,               -- 时长（秒）
    bitrate     INTEGER,            -- 比特率（kbps）
    format      TEXT,               -- 格式（MP3/FLAC）
    codec       TEXT,               -- 编解码器
    size        INTEGER,            -- 文件大小（字节）
    cover       TEXT,               -- 封面路径（如 /covers/id_cover.png）
    lyrics      TEXT,               -- 歌词文本
    file_mtime  INTEGER,            -- 文件修改时间戳
    upload_time DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 许可证

[MIT](LICENSE)
