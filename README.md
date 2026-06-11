# Music Share Web

局域网音乐分享平台 — 在浏览器中浏览、播放和管理你的音乐收藏。

## 功能

- **音乐库管理** — 自动扫描本地音乐目录，提取 MP3/FLAC 元数据（标题、艺术家、专辑、封面）
- **在线播放** — 浏览器内直接流媒体播放，支持封面、LRC 歌词同步显示，网易云风格播放详情页
- **内嵌歌词** — 自动解析 MP3 ID3v2 USLT 帧 和 FLAC Vorbis LYRICS 字段
- **歌曲统计** — 首页显示歌曲总数、总大小、总时长、格式分布
- **文件上传** — 通过 Web 界面上传新音乐文件，自动解析元数据
- **搜索** — 按标题、艺术家或专辑搜索音乐库
- **增量扫描** — 仅检测新增/修改/删除的文件，避免全量扫描
- **错误日志** — 扫描错误持久化到 `logs/scan-errors.log`
- **用户认证** — 基于 Session 的登录保护

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express 5 (CommonJS) |
| 数据库 | SQLite (sqlite3) |
| 前端 | 原生 HTML/CSS/JS + Bootstrap 5.3 + Font Awesome 6 |
| 元数据 | music-metadata |
| 文件上传 | multer |
| 测试 | Jest + supertest |

## 项目结构

```
music-share-web/
├── app.js                  # 应用入口
├── package.json
├── src/
│   ├── middleware/
│   │   ├── auth.js         # 认证中间件
│   │   └── csp.js          # CSP 安全头
│   ├── routes/
│   │   ├── api.js          # /api 路由（音乐 CRUD、上传、搜索、扫描）
│   │   ├── auth.js         # /auth 路由（登录/登出）
│   │   └── music.js        # /music 路由（文件流媒体）
│   └── utils/
│       ├── database.js     # SQLite 数据库单例
│       ├── logger.js       # 错误日志持久化
│       ├── metadata.js     # 音乐元数据提取（含内嵌歌词）
│       └── scanner.js      # 增量文件扫描器
├── public/
│   ├── index.html          # 主页面（SPA）
│   ├── login.html          # 登录页面
│   ├── css/style.css
│   ├── js/app.js
│   └── covers/             # 提取的封面图片
├── tests/                  # Jest 测试用例
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

创建 `.env` 文件：

```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=your-secret-key-here
```

### 运行

```bash
# 生产模式
npm start

# 开发模式（热重载）
npm run dev
```

启动后访问 `http://localhost:3000`。

默认登录凭据：`admin` / `admin`

## API 接口

所有 API 需要登录（除封面获取外），挂载在 `/api` 路径下。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/music/list` | 获取音乐列表 |
| GET | `/api/music/stats` | 获取歌曲统计（总数/大小/时长/格式分布） |
| GET | `/api/music/play/:id` | 获取播放 URL |
| GET | `/api/music/cover/:id` | 获取封面图片（无需认证） |
| GET | `/api/music/search?q=` | 搜索音乐 |
| POST | `/api/music/upload` | 上传音乐文件（MP3/FLAC，限 100MB） |
| DELETE | `/api/music/:id` | 删除音乐（同时删除文件和数据库记录） |
| POST | `/api/music/rescan` | 触发增量扫描 |
| GET | `/api/music/scan-status` | 查询扫描状态 |
| POST | `/api/music/scan-stop` | 停止扫描 |

文件流媒体端点（无需认证）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/music/file?name=<filename>` | 流媒体播放音频文件，支持 Range 请求 |

## 测试

```bash
# 运行全部测试（16 个用例，4 个套件）
npm test
```

测试覆盖：
- **database.test.js** — 统计查询、聚合函数、结果结构
- **logger.test.js** — 单条写入、批量写入、目录自动创建
- **scanner.test.js** — 错误收集、降级处理、日志持久化
- **api.test.js** — Stats API 正常/异常/空库响应

## Docker 部署

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

每次推送 `master` 分支会自动触发 GitHub Actions 构建并推送到阿里云 ACR。

## 许可证

[MIT](LICENSE)
