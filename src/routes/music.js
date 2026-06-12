const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const database = require('../utils/database');

// 音乐文件存储目录
const MUSIC_DIR = path.join(__dirname, '../../music');

// 确保音乐目录存在
if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

// 获取音乐文件（使用查询参数避免 URL 路径中的编码问题）
router.get('/file', (req, res) => {
    const filename = req.query.name;
    
    if (!filename) {
        return res.status(400).json({ success: false, message: '缺少文件名参数' });
    }
    
    // 安全检查：防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(403).json({ success: false, message: '非法访问' });
    }
    
    const filePath = path.join(MUSIC_DIR, filename);

    // 优先从内存缓存获取文件大小，消除同步磁盘 I/O
    let fileSize;
    const cached = database.getFileMeta(filename);
    if (cached && cached.size) {
        fileSize = cached.size;
    } else if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        fileSize = stat.size;
        // 回填缓存
        database.addFileMeta(filename, { size: fileSize, mtime: Math.floor(stat.mtimeMs / 1000) });
    } else {
        return res.status(404).json({ success: false, message: '文件不存在' });
    }

    const range = req.headers.range;
    
    // 根据文件扩展名设置正确的Content-Type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'audio/mpeg'; // 默认为mp3
    if (ext === '.flac') {
        contentType = 'audio/flac';
    } else if (ext === '.mp3') {
        contentType = 'audio/mpeg';
    }
    
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': contentType,
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

module.exports = router;