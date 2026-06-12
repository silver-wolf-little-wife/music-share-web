const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { extractMetadata, extractCover, extractLyrics, isAudioFile } = require('./metadata');
const logger = require('./logger');

/**
 * 音乐文件全量扫描器
 * 每次扫描均全量处理所有音频文件
 */
class MusicScanner {
    constructor(database, musicDir, coverDir) {
        this.database = database;
        this.musicDir = musicDir;
        this.coverDir = coverDir;
        this.isScanning = false;
        this.scanProgress = 0;
        this.scanStatus = 'idle'; // idle, scanning, completed, error
        this.scanResults = null;
        this.onProgress = null;
        this.currentScanId = null;
    }

    /**
     * 开始全量扫描
     * @param {Function} progressCallback - 进度回调函数
     * @returns {Promise<Object>} 扫描结果
     */
    async startFullScan(progressCallback = null) {
        if (this.isScanning) {
            throw new Error('扫描正在进行中');
        }

        this.isScanning = true;
        this.scanStatus = 'scanning';
        this.scanProgress = 0;
        this.onProgress = progressCallback;
        this.currentScanId = uuidv4();

        try {
            console.log('开始全量扫描音乐目录...');
            const results = await this.performFullScan();
            this.scanStatus = 'completed';
            this.scanResults = results;

            // 持久化扫描错误到日志文件
            if (results.errors && results.errors.length > 0) {
                logger.writeScanErrors(results.errors);
            }

            return results;
        } catch (error) {
            console.error('扫描失败:', error);
            this.scanStatus = 'error';
            // 顶层扫描失败也记录到日志
            logger.writeErrorLog({
                type: 'scan_error',
                message: error.message
            });
            throw error;
        } finally {
            this.isScanning = false;
            this.onProgress = null;
            this.currentScanId = null;
        }
    }

    /**
     * 执行全量扫描
     * @returns {Promise<Object>} 扫描结果
     */
    async performFullScan() {
        const results = {
            added: [],
            updated: [],
            deletedCount: 0,
            errors: [],
            totalProcessed: 0,
            startTime: new Date()
        };

        try {
            // 1. 扫描文件系统获取所有音频文件
            const allFiles = await this.scanDirectory(this.musicDir);
            this.updateProgress(10);

            // 2. 全量处理所有文件（每个文件都提取元数据并写入数据库）
            if (allFiles.length > 0) {
                await this.processAllFiles(allFiles, results);
            }
            this.updateProgress(90);

            // 3. 删除数据库中已不存在的文件记录
            const currentFilenames = allFiles.map(f => f.filename);
            const deleteResult = await this.database.deleteNonExistentFiles(currentFilenames);
            results.deletedCount = deleteResult.deletedCount || 0;

            // 4. 完成扫描
            results.endTime = new Date();
            results.duration = results.endTime - results.startTime;
            results.totalProcessed = results.added.length + results.updated.length + results.deletedCount;

            console.log('全量扫描完成:', {
                新增: results.added.length,
                更新: results.updated.length,
                删除: results.deletedCount,
                错误: results.errors.length,
                耗时: `${results.duration}ms`
            });

            this.updateProgress(100);
            return results;

        } catch (error) {
            results.errors.push({
                type: 'scan_error',
                message: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * 扫描目录获取所有音频文件
     * @param {string} dirPath - 目录路径
     * @returns {Promise<Array>} 文件信息数组
     */
    async scanDirectory(dirPath) {
        const files = [];
        
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isFile() && isAudioFile(entry.name)) {
                    try {
                        const stat = fs.statSync(fullPath);
                        files.push({
                            filename: entry.name,
                            fullPath: fullPath,
                            mtime: Math.floor(stat.mtime.getTime() / 1000) // 转换为秒
                        });
                    } catch (error) {
                        console.warn(`无法读取文件信息: ${fullPath}`, error.message);
                    }
                } else if (entry.isDirectory()) {
                    // 递归扫描子目录
                    const subFiles = await this.scanDirectory(fullPath);
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            console.error(`扫描目录失败: ${dirPath}`, error);
        }
        
        return files;
    }

    /**
     * 处理所有文件（全量处理，区分新增和更新）
     * @param {Array} filesToProcess - 需要处理的文件列表
     * @param {Object} results - 扫描结果对象
     */
    async processAllFiles(filesToProcess, results) {
        console.log(`正在全量处理 ${filesToProcess.length} 个音频文件`);
        
        const batchSize = 10; // 每批处理10个文件
        const totalBatches = Math.ceil(filesToProcess.length / batchSize);
        
        for (let i = 0; i < filesToProcess.length; i += batchSize) {
            const batch = filesToProcess.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            
            try {
                await this.processBatch(batch, results);
                
                // 更新进度（10% ~ 90%）
                const baseProgress = 10;
                const progressRange = 80;
                const batchProgress = (batchNumber / totalBatches) * progressRange;
                this.updateProgress(baseProgress + batchProgress);
                
            } catch (error) {
                results.errors.push({
                    type: 'batch_error',
                    message: `批次 ${batchNumber} 处理失败: ${error.message}`,
                    batch: batch,
                    timestamp: new Date()
                });
            }
        }
    }

    /**
     * 处理一批文件
     * @param {Array} batch - 文件批次
     * @param {Object} results - 扫描结果对象
     */
    async processBatch(batch, results) {
        const newFiles = [];
        const updatedFiles = [];
        
        for (const file of batch) {
            try {
                const musicData = await this.extractMusicData(file);
                
                // 检查文件是否已存在
                const existingRecord = await this.database.getMusicByFilename(file.filename);
                
                if (existingRecord) {
                    // 更新现有记录
                    musicData.id = existingRecord.id;
                    updatedFiles.push(musicData);
                } else {
                    // 新增记录
                    newFiles.push(musicData);
                }
                
            } catch (error) {
                results.errors.push({
                    type: 'file_error',
                    message: `处理文件 ${file.filename} 失败: ${error.message}`,
                    file: file.filename,
                    timestamp: new Date()
                });
            }
        }
        
        // 批量添加新文件
        if (newFiles.length > 0) {
            try {
                await this.database.batchAddMusic(newFiles);
                results.added.push(...newFiles);
            } catch (error) {
                results.errors.push({
                    type: 'batch_add_error',
                    message: `批量添加失败: ${error.message}`,
                    files: newFiles.map(f => f.filename),
                    timestamp: new Date()
                });
            }
        }
        
        // 批量更新文件
        if (updatedFiles.length > 0) {
            try {
                await this.database.batchUpdateMusic(updatedFiles);
                results.updated.push(...updatedFiles);
            } catch (error) {
                results.errors.push({
                    type: 'batch_update_error',
                    message: `批量更新失败: ${error.message}`,
                    files: updatedFiles.map(f => f.filename),
                    timestamp: new Date()
                });
            }
        }
    }

    /**
     * 提取音乐数据
     * @param {Object} file - 文件信息
     * @returns {Promise<Object>} 音乐数据
     */
    async extractMusicData(file) {
        // 提取元数据
        const metadata = await extractMetadata(file.fullPath);
        
        // 提取封面（使用完整文件名作为 ID，避免同名不同扩展名冲突）
        const musicId = file.filename;
        const coverPath = await extractCover(file.fullPath, musicId);
        
        // 提取歌词
        const lyrics = await extractLyrics(file.fullPath);
        
        // 获取文件统计信息
        const stat = fs.statSync(file.fullPath);
        
        return {
            id: musicId,
            filename: file.filename,
            title: metadata?.title || musicId,
            artist: metadata?.artist || '未知艺术家',
            album: metadata?.album || '未知专辑',
            year: metadata?.year || null,
            genre: metadata?.genre || null,
            duration: metadata?.duration || 0,
            bitrate: metadata?.bitrate || null,
            format: metadata?.format || path.extname(file.filename).substring(1).toUpperCase(),
            codec: metadata?.codec || null,
            size: stat.size,
            cover: coverPath ? `/covers/${path.basename(coverPath)}` : null,
            lyrics: lyrics,
            file_mtime: file.mtime
        };
    }

    /**
     * 更新扫描进度
     * @param {number} progress - 进度百分比 (0-100)
     */
    updateProgress(progress) {
        this.scanProgress = Math.min(100, Math.max(0, progress));
        
        if (this.onProgress) {
            this.onProgress({
                progress: this.scanProgress,
                status: this.scanStatus,
                scanId: this.currentScanId
            });
        }
    }

    /**
     * 获取当前扫描状态
     * @returns {Object} 扫描状态信息
     */
    getScanStatus() {
        return {
            isScanning: this.isScanning,
            status: this.scanStatus,
            progress: this.scanProgress,
            scanId: this.currentScanId,
            results: this.scanResults
        };
    }

    /**
     * 停止当前扫描
     */
    stopScan() {
        if (this.isScanning) {
            this.isScanning = false;
            this.scanStatus = 'stopped';
            console.log('扫描已停止');
        }
    }
}

module.exports = MusicScanner;