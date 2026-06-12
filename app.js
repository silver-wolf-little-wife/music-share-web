require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const favicon = require('serve-favicon');

// 导入路由
const authRoutes = require('./src/routes/auth');
const musicRoutes = require('./src/routes/music');
const apiRoutes = require('./src/routes/api');

// 导入中间件
const { authMiddleware } = require('./src/middleware/auth');
const cspMiddleware = require('./src/middleware/csp');

// 导入日志工具
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV === 'development';

// 开发模式日志
if (isDevelopment) {
  console.log('🚀 开发模式已启用');
  console.log('📝 NODE_ENV:', process.env.NODE_ENV);
  console.log('🔥 热重载功能测试');
}

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 开发模式下的请求日志
if (isDevelopment) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

app.use(cspMiddleware);

// 会话配置
app.use(session({
  secret: process.env.SESSION_SECRET || 'music-share-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 } // 1小时
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
app.use('/music', express.static(path.join(__dirname, 'music')));

// 设置视图引擎
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'views'));

// 路由配置
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/music', musicRoutes);

// 主页路由 - 需要登录
app.get('/', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 登录页面
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('❌ 错误:', err.message);

  if (isDevelopment) {
    console.error('错误堆栈:', err.stack);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: err.stack,
      development: true
    });
  } else {
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 预初始化：数据库和扫描在监听端口之前完成
(async function initializeBeforeListen() {
  const database = require('./src/utils/database');
  const path = require('path');

  try {
    // 1. 初始化数据库（连接、建表、file_mtime 兼容、WAL 模式）
    await database.init();
    console.log('💾 数据库初始化成功');

    // 2. 扫描音乐文件
    await scanMusicFilesOnStartup();

    // 3. 构建文件元数据内存缓存（供 music.js 消除同步 I/O）
    await buildFileMetaCache(database);
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    process.exit(1);
  }

  // 数据库和缓存就绪后，开始监听端口
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎵 音乐分享服务器已启动！`);
    console.log(`📍 访问地址: http://localhost:${PORT}`);
    console.log(`🌐 局域网访问地址: http://YOUR_LOCAL_IP:${PORT}`);

    if (isDevelopment) {
      console.log('🔧 开发模式特性:');
      console.log('   - 热重载已启用 (nodemon)');
      console.log('   - 请求日志已开启');
      console.log('   - 详细错误信息已启用');
    }
  });
})();

// 服务器启动时扫描音乐文件
async function scanMusicFilesOnStartup() {
  try {
    console.log('🔍 开始扫描音乐文件...');
    
    const database = require('./src/utils/database');
    const MusicScanner = require('./src/utils/scanner');
    const path = require('path');
    
    // 获取音乐目录路径
    const musicDir = path.join(__dirname, 'music');
    const coverDir = path.join(__dirname, 'public', 'covers');
    
    // 创建扫描器实例
    const scanner = new MusicScanner(database, musicDir, coverDir);
    
    // 开始增量扫描
    const scanResults = await scanner.startIncrementalScan((progress) => {
      // 简单的进度提示
      if (progress.progress % 20 === 0 || progress.progress === 100) {
        console.log(`📊 扫描进度: ${progress.progress}%`);
      }
    });
    
    // 显示扫描结果
    console.log('✅ 音乐文件扫描完成!');
    console.log(`📈 扫描统计:`);
    console.log(`   - 新增音乐: ${scanResults.added.length} 首`);
    console.log(`   - 更新音乐: ${scanResults.updated.length} 首`);
    console.log(`   - 删除音乐: ${scanResults.deleted.length} 首`);
    console.log(`   - 扫描耗时: ${scanResults.duration}ms`);
    
    if (scanResults.errors.length > 0) {
      console.warn(`⚠️  扫描过程中发现 ${scanResults.errors.length} 个错误`);
      // 持久化启动扫描的错误到日志文件
      logger.writeScanErrors(scanResults.errors);
    }
    
  } catch (error) {
    console.error('❌ 音乐文件扫描失败:', error.message);
    console.log('⚠️  扫描失败不影响服务器正常启动');
    // 顶层扫描失败也写入日志
    logger.writeErrorLog({ type: 'scan_error', message: error.message });
  }
}

// 构建文件元数据内存缓存（基于数据库记录）
async function buildFileMetaCache(database) {
  try {
    const allMusic = await database.getAllMusic();
    const metaMap = new Map();
    for (const music of allMusic) {
      metaMap.set(music.filename, {
        size: music.size,
        mtime: music.file_mtime
      });
    }
    database.setFileMetaCache(metaMap);
    console.log(`📋 文件元数据缓存已构建 (${metaMap.size} 项)`);
  } catch (error) {
    console.warn('⚠️  文件元数据缓存构建失败:', error.message);
  }
}

module.exports = app;