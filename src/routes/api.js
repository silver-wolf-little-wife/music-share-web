const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { apiAuthMiddleware } = require('../middleware/auth');
const { extractMetadata, extractCover, extractLyrics } = require('../utils/metadata');
const database = require('../utils/database');
const MusicScanner = require('../utils/scanner');

// 音乐文件存储目录
const MUSIC_DIR = path.join(__dirname, '../../music');
const COVER_DIR = path.join(__dirname, '../../public/covers');

// 确保目录存在
if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
}
if (!fs.existsSync(COVER_DIR)) {
    fs.mkdirSync(COVER_DIR, { recursive: true });
}

// 配置multer用于文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, MUSIC_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['.mp3', '.flac'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('只支持MP3和FLAC格式'));
        }
    },
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB限制
    }
});

// 全局扫描器实例
let musicScanner = null;

// 获取音乐列表
router.get('/music/list', apiAuthMiddleware, async (req, res) => {
    try {
        const musicList = await database.getAllMusicCached();
        res.json({ 
            success: true, 
            music: musicList 
        });
    } catch (error) {
        console.error('获取音乐列表失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取音乐列表失败' 
        });
    }
});

// 获取音乐统计信息
router.get('/music/stats', apiAuthMiddleware, async (req, res) => {
    try {
        const stats = await database.getMusicStats();
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('获取音乐统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取音乐统计失败'
        });
    }
});

// 获取音乐播放URL
router.get('/music/play/:id', apiAuthMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        const music = await database.getMusicById(id);
        
        if (music) {
            res.json({ 
                success: true, 
                url: `/music/file?name=${encodeURIComponent(music.filename)}` 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: '音乐不存在' 
            });
        }
    } catch (error) {
        console.error('获取音乐播放URL失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取音乐播放URL失败' 
        });
    }
});

// 获取音乐封面
router.get('/music/cover/:id', async (req, res) => {
    try {
        const id = req.params.id;
        
        // 安全检查：防止路径遍历攻击
        if (id.includes('..') || id.includes('/') || id.includes('\\')) {
            return res.status(403).json({ success: false, message: '非法访问' });
        }
        
        const music = await database.getMusicById(id);
        
        if (music && music.cover) {
            const coverPath = path.join(__dirname, '../../public', music.cover);
            if (fs.existsSync(coverPath)) {
                res.sendFile(coverPath);
                return;
            }
        }
        
        // 返回默认封面
        res.status(404).send('Not Found');
    } catch (error) {
        console.error('获取封面失败:', error);
        res.status(500).json({ success: false, message: '获取封面失败' });
    }
});

// 上传音乐
router.post('/music/upload', apiAuthMiddleware, upload.single('music'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ 
            success: false, 
            message: '没有上传文件' 
        });
    }
    
    try {
        const id = path.basename(req.file.filename, path.extname(req.file.filename));
        const musicInfo = {
            id: id,
            filename: req.file.filename,
            title: path.basename(req.file.originalname, path.extname(req.file.originalname)),
            artist: '未知艺术家',
            album: '未知专辑',
            duration: 0,
            size: req.file.size,
            format: path.extname(req.file.originalname).substring(1).toUpperCase(),
            bitrate: null,
            cover: null,
            lyrics: null,
            file_mtime: Math.floor(Date.now() / 1000),
            uploadTime: new Date()
        };
        
        // 提取元数据
        try {
            const metadata = await extractMetadata(req.file.path);
            if (metadata) {
                musicInfo.title = metadata.title || musicInfo.title;
                musicInfo.artist = metadata.artist || musicInfo.artist;
                musicInfo.album = metadata.album || musicInfo.album;
                musicInfo.duration = metadata.duration || 0;
                musicInfo.bitrate = metadata.bitrate || null;
            }
            
            // 提取封面
            const coverPath = await extractCover(req.file.path, id);
            if (coverPath) {
                musicInfo.cover = `/covers/${path.basename(coverPath)}`;
            }
            
            // 提取歌词
            const lyrics = await extractLyrics(req.file.path);
            if (lyrics) {
                musicInfo.lyrics = lyrics;
            }
        } catch (error) {
            console.error('提取元数据失败:', error);
        }
        
        // 保存到数据库
        await database.addMusic(musicInfo);

        // 更新缓存
        database.addFileMeta(musicInfo.filename, {
            size: musicInfo.size,
            mtime: musicInfo.file_mtime
        });
        database.invalidateMusicListCache();

        res.json({ 
            success: true, 
            message: '上传成功',
            music: musicInfo
        });
    } catch (error) {
        console.error('上传处理失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '上传失败' 
        });
    }
});

// 删除音乐
router.delete('/music/:id', apiAuthMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        
        // 先获取音乐信息用于删除文件
        const music = await database.getMusicById(id);
        if (!music) {
            return res.status(404).json({ 
                success: false, 
                message: '音乐不存在' 
            });
        }
        
        // 删除音乐文件
        const musicPath = path.join(MUSIC_DIR, music.filename);
        if (fs.existsSync(musicPath)) {
            fs.unlinkSync(musicPath);
        }
        
        // 删除封面文件
        if (music.cover) {
            const coverPath = path.join(__dirname, '../../public', music.cover);
            if (fs.existsSync(coverPath)) {
                fs.unlinkSync(coverPath);
            }
        }
        
        // 从数据库中删除
        await database.deleteMusic(id);

        // 更新缓存
        database.removeFileMeta(music.filename);
        database.invalidateMusicListCache();

        res.json({ 
            success: true, 
            message: '删除成功' 
        });
    } catch (error) {
        console.error('删除音乐失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '删除失败' 
        });
    }
});

// 搜索音乐
router.get('/music/search', apiAuthMiddleware, async (req, res) => {
    try {
        const query = req.query.q || '';
        const results = await database.searchMusic(query);
        
        res.json({ 
            success: true, 
            results: results 
        });
    } catch (error) {
        console.error('搜索音乐失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '搜索音乐失败' 
        });
    }
});

// 重新扫描音乐目录
router.post('/music/rescan', apiAuthMiddleware, async (req, res) => {
    try {
        
        // 初始化扫描器（如果尚未初始化）
        if (!musicScanner) {
            musicScanner = new MusicScanner(database, MUSIC_DIR, COVER_DIR);
        }
        
        // 检查是否已有扫描在进行
        if (musicScanner.isScanning) {
            return res.status(409).json({
                success: false,
                message: '扫描正在进行中',
                status: musicScanner.getScanStatus()
            });
        }
        
        // 开始扫描
        const scanPromise = musicScanner.startFullScan((progress) => {
            // 这里可以通过 WebSocket 或其他方式实时推送进度
            console.log(`扫描进度: ${progress.progress}%`);
        });
        
        // 不等待扫描完成，立即返回扫描ID
        res.json({
            success: true,
            message: '扫描已开始',
            scanId: musicScanner.currentScanId,
            status: musicScanner.getScanStatus()
        });
        
        // 在后台继续执行扫描，完成后刷新缓存
        scanPromise
            .then(async () => {
                await database.refreshMusicListCache();
            })
            .catch(error => {
            console.error('后台扫描失败:', error);
        });
        
    } catch (error) {
        console.error('启动扫描失败:', error);
        res.status(500).json({
            success: false,
            message: '启动扫描失败: ' + error.message
        });
    }
});

// 获取扫描状态
router.get('/music/scan-status', apiAuthMiddleware, async (req, res) => {
    try {
        if (!musicScanner) {
            return res.json({
                success: true,
                status: {
                    isScanning: false,
                    status: 'idle',
                    progress: 0,
                    scanId: null,
                    results: null
                }
            });
        }
        
        const status = musicScanner.getScanStatus();
        res.json({
            success: true,
            status: status
        });
        
    } catch (error) {
        console.error('获取扫描状态失败:', error);
        res.status(500).json({
            success: false,
            message: '获取扫描状态失败: ' + error.message
        });
    }
});

// 停止扫描
router.post('/music/scan-stop', apiAuthMiddleware, async (req, res) => {
    try {
        if (!musicScanner || !musicScanner.isScanning) {
            return res.status(400).json({
                success: false,
                message: '没有正在进行的扫描'
            });
        }
        
        musicScanner.stopScan();
        
        res.json({
            success: true,
            message: '扫描已停止',
            status: musicScanner.getScanStatus()
        });
        
    } catch (error) {
        console.error('停止扫描失败:', error);
        res.status(500).json({
            success: false,
            message: '停止扫描失败: ' + error.message
        });
    }
});

module.exports = router;