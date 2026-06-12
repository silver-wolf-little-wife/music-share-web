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
    let fileMtime;
    const cached = database.getFileMeta(filename);
    if (cached && cached.size) {
        fileSize = cached.size;
        fileMtime = cached.mtime;
    } else if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        fileSize = stat.size;
        fileMtime = Math.floor(stat.mtimeMs / 1000);
        // 回填缓存
        database.addFileMeta(filename, { size: fileSize, mtime: fileMtime });
    } else {
        return res.status(404).json({ success: false, message: '文件不存在' });
    }

    // 根据文件扩展名设置正确的Content-Type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'audio/mpeg';
    if (ext === '.flac') {
        contentType = 'audio/flac';
    } else if (ext === '.mp3') {
        contentType = 'audio/mpeg';
    }

    // HTTP 缓存：利用已有 mtime 生成 ETag，减少重复播放时的网络传输
    const etag = `W/"${fileMtime}-${fileSize}"`;
    const lastModified = new Date(fileMtime * 1000).toUTCString();
    const cacheControl = 'public, max-age=3600';

    // 检查条件请求头
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];

    if (ifNoneMatch && ifNoneMatch === etag) {
        res.writeHead(304, {
            'ETag': etag,
            'Cache-Control': cacheControl,
            'Last-Modified': lastModified
        });
        return res.end();
    }

    if (!ifNoneMatch && ifModifiedSince && ifModifiedSince === lastModified) {
        res.writeHead(304, {
            'ETag': etag,
            'Cache-Control': cacheControl,
            'Last-Modified': lastModified
        });
        return res.end();
    }

    const range = req.headers.range;
    
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
            'ETag': etag,
            'Cache-Control': cacheControl,
            'Last-Modified': lastModified
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'ETag': etag,
            'Cache-Control': cacheControl,
            'Last-Modified': lastModified
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

module.exports = router;
