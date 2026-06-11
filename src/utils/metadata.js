const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');

/**
 * 提取音频文件元数据
 * @param {string} filePath - 音频文件路径
 * @returns {object} 元数据对象
 */
async function extractMetadata(filePath) {
    try {
        const metadata = await mm.parseFile(filePath);
        
        const result = {
            title: metadata.common.title || null,
            artist: metadata.common.artist || null,
            album: metadata.common.album || null,
            year: metadata.common.year || null,
            genre: metadata.common.genre || null,
            duration: metadata.format.duration || 0,
            bitrate: metadata.format.bitrate || null,
            format: metadata.format.container || null,
            codec: metadata.format.codec || null
        };
        
        return result;
    } catch (error) {
        console.error('提取元数据失败:', error);
        return null;
    }
}

/**
 * 提取音频文件封面并保存
 * @param {string} filePath - 音频文件路径
 * @param {string} musicId - 音乐ID
 * @returns {string|null} 封面文件路径
 */
async function extractCover(filePath, musicId) {
    try {
        const metadata = await mm.parseFile(filePath);
        
        if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];
            const coverDir = path.join(__dirname, '../../public/covers');
            const coverFormat = picture.format.replace('/', '');
            const coverPath = path.join(coverDir, `${musicId}_cover.${coverFormat}`);
            
            // 确保封面目录存在
            if (!fs.existsSync(coverDir)) {
                fs.mkdirSync(coverDir, { recursive: true });
            }
            
            // 保存封面文件
            fs.writeFileSync(coverPath, picture.data);
            
            return coverPath;
        }
        
        return null;
    } catch (error) {
        console.error('提取封面失败:', error);
        return null;
    }
}

/**
 * 提取音频文件歌词
 * @param {string} filePath - 音频文件路径
 * @returns {string|null} 歌词文本
 */
/**
 * 将 music-metadata 返回的 lyrics 值标准化为字符串
 * .value 可能是 Buffer、string、string[] 等类型
 */
function normalizeLyricsValue(value) {
    if (!value) return null;
    // Buffer → UTF-8 字符串
    if (Buffer.isBuffer(value)) {
        return value.toString('utf-8').trim() || null;
    }
    // 字符串数组 → 用换行符连接
    if (Array.isArray(value)) {
        const text = value.map(v => {
            if (typeof v === 'string') return v;
            if (v && v.text) return v.text;  // USLT { descriptor, text }
            return String(v);
        }).join('\n').trim();
        return text || null;
    }
    // USLT 单条 { descriptor, text }
    if (value && typeof value === 'object' && value.text) {
        return String(value.text).trim() || null;
    }
    // 字符串直接返回
    if (typeof value === 'string') {
        return value.trim() || null;
    }
    return null;
}

async function extractLyrics(filePath) {
    try {
        const metadata = await mm.parseFile(filePath);
        let lyrics = null;

        // 1. 尝试从 native Vorbis LYRICS 字段提取（FLAC/OGG 等格式）
        if (metadata.native && metadata.native.vorbis) {
            const lyricsField = metadata.native.vorbis.find(field => field.id === 'LYRICS');
            if (lyricsField) {
                lyrics = normalizeLyricsValue(lyricsField.value);
            }
        }

        // 2. 尝试从 native ID3v2 USLT 帧提取（MP3 等格式，music-metadata v7 不会把它映射到 common）
        if (!lyrics && metadata.native) {
            const id3v2 = metadata.native['ID3v2.3'] || metadata.native['ID3v2.4'] || metadata.native['ID3v2.2'] || metadata.native['ID3v23'] || metadata.native['ID3v24'] || metadata.native['ID3v22'];
            if (id3v2) {
                const uslt = id3v2.find(tag => tag.id === 'USLT');
                if (uslt) {
                    lyrics = normalizeLyricsValue(uslt.value);
                }
            }
        }

        // 3. 尝试从 common.uslt 提取（music-metadata 后续版本支持）
        if (!lyrics && metadata.common.uslt) {
            lyrics = normalizeLyricsValue(metadata.common.uslt);
        }

        // 4. 尝试从 common.lyrics 提取
        if (!lyrics) {
            lyrics = normalizeLyricsValue(metadata.common.lyrics);
        }

        return lyrics;
    } catch (error) {
        console.error('提取歌词失败:', error);
        return null;
    }
}

/**
 * 扫描目录中的音频文件
 * @param {string} dirPath - 目录路径
 * @returns {array} 音频文件列表
 */
function scanMusicDirectory(dirPath) {
    const audioFiles = [];
    
    try {
        const files = fs.readdirSync(dirPath);
        
        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isFile() && isAudioFile(file)) {
                audioFiles.push(filePath);
            } else if (stat.isDirectory()) {
                // 递归扫描子目录
                const subFiles = scanMusicDirectory(filePath);
                audioFiles.push(...subFiles);
            }
        });
    } catch (error) {
        console.error('扫描目录失败:', error);
    }
    
    return audioFiles;
}

/**
 * 检查文件是否为音频文件
 * @param {string} filename - 文件名
 * @returns {boolean} 是否为音频文件
 */
function isAudioFile(filename) {
    const audioExtensions = ['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a'];
    const ext = path.extname(filename).toLowerCase();
    return audioExtensions.includes(ext);
}

/**
 * 格式化时长
 * @param {number} seconds - 秒数
 * @returns {string} 格式化的时长字符串
 */
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化的文件大小字符串
 */
function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}



module.exports = {
    extractMetadata,
    extractCover,
    extractLyrics,
    scanMusicDirectory,
    isAudioFile,
    formatDuration,
    formatFileSize
};