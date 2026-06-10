const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { extractMetadata, extractCover, extractLyrics, isAudioFile } = require('./metadata');

/**
 * 智能音乐文件扫描器
 * 支持增量扫描、文件变更检测和批量处理
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
     * 开始增量扫描
     * @param {Function} progressCallback - 进度回调函数
     * @returns {Promise<Object>} 扫描结果
     */
    async startIncrementalScan(progressCallback = null) {
        if (this.isScanning) {
            throw new Error('扫描正在进行中');
        }

        this.isScanning = true;
        this.scanStatus = 'scanning';
        this.scanProgress = 0;
        this.onProgress = progressCallback;
        this.currentScanId = uuidv4();

        try {
            console.log('开始增量扫描音乐目录...');
            const results = await this.performIncrementalScan();
            this.scanStatus = 'completed';
            this.scanResults = results;
            return results;
        } catch (error) {
            console.error('扫描失败:', error);
            this.scanStatus = 'error';
            throw error;
        } finally {
            this.isScanning = false;
            this.onProgress = null;
            this.currentScanId = null;
        }
    }

    /**
     * 执行增量扫描
     * @returns {Promise<Object>} 扫描结果
     */
    async performIncrementalScan() {
        const results = {
            added: [],
            updated: [],
            deleted: [],
            errors: [],
            totalProcessed: 0,
            startTime: new Date()
        };

        try {
            // 1. 获取数据库中现有的音乐记录
            const existingRecords = await this.database.getAllMusicFilenamesAndMtime();
            const existingFileMap = new Map(
                existingRecords.map(record => [record.filename, { id: record.id, mtime: record.file_mtime }])
            );

            // 2. 扫描文件系统获取所有音频文件
            const currentFiles = await this.scanDirectory(this.musicDir);
            this.updateProgress(10);

            // 3. 分析文件变更
            const changes = this.analyzeChanges(currentFiles, existingFileMap);
            this.updateProgress(20);

            // 4. 处理已删除的文件
            if (changes.deleted.length > 0) {
                await this.processDeletedFiles(changes.deleted, results);
            }
            this.updateProgress(30);

            // 5. 处理新增和修改的文件
            const filesToProcess = [...changes.new, ...changes.modified];
            if (filesToProcess.length > 0) {
                await this.processNewAndModifiedFiles(filesToProcess, results);
            }
            this.updateProgress(90);

            // 6. 完成扫描
            results.endTime = new Date();
            results.duration = results.endTime - results.startTime;
            results.totalProcessed = results.added.length + results.updated.length + results.deleted.length;

            console.log('增量扫描完成:', {
                新增: results.added.length,
                更新: results.updated.length,
                删除: results.deleted.length,
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
     * 分析文件变更
     * @param {Array} currentFiles - 当前文件系统中的文件
     * @param {Map} existingFileMap - 数据库中现有文件的映射
     * @returns {Object} 变更分析结果
     */
    analyzeChanges(currentFiles, existingFileMap) {
        const currentFileMap = new Map(
            currentFiles.map(file => [file.filename, file])
        );

        const changes = {
            new: [],
            modified: [],
            deleted: [],
            unchanged: []
        };

        // 检查当前文件系统中的文件
        for (const [filename, fileInfo] of currentFileMap) {
            const existingRecord = existingFileMap.get(filename);
            
            if (!existingRecord) {
                // 新文件
                changes.new.push(fileInfo);
            } else if (!existingRecord.mtime || fileInfo.mtime > existingRecord.mtime) {
                // 文件已修改
                changes.modified.push(fileInfo);
            } else {
                // 文件未变更
                changes.unchanged.push(fileInfo);
            }
        }

        // 检查已删除的文件
        for (const [filename, record] of existingFileMap) {
            if (!currentFileMap.has(filename)) {
                changes.deleted.push({
                    filename: filename,
                    id: record.id
                });
            }
        }

        console.log('文件变更分析:', {
            新增: changes.new.length,
            修改: changes.modified.length,
            删除: changes.deleted.length,
            未变更: changes.unchanged.length
        });

        return changes;
    }

    /**
     * 处理已删除的文件
     * @param {Array} deletedFiles - 已删除文件列表
     * @param {Object} results - 扫描结果对象
     */
    async processDeletedFiles(deletedFiles, results) {
        console.log(`处理 ${deletedFiles.length} 个已删除的文件`);
        
        const filenames = deletedFiles.map(file => file.filename);
        
        try {
            const deleteResult = await this.database.deleteNonExistentFiles(filenames);
            results.deleted.push(...deletedFiles);
        } catch (error) {
            results.errors.push({
                type: 'delete_error',
                message: `删除文件记录失败: ${error.message}`,
                files: deletedFiles,
                timestamp: new Date()
            });
        }
    }

    /**
     * 处理新增和修改的文件
     * @param {Array} filesToProcess - 需要处理的文件列表
     * @param {Object} results - 扫描结果对象
     */
    async processNewAndModifiedFiles(filesToProcess, results) {
        console.log(`处理 ${filesToProcess.length} 个新增和修改的文件`);
        
        const batchSize = 10; // 每批处理10个文件
        const totalBatches = Math.ceil(filesToProcess.length / batchSize);
        
        for (let i = 0; i < filesToProcess.length; i += batchSize) {
            const batch = filesToProcess.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            
            try {
                await this.processBatch(batch, results);
                
                // 更新进度
                const baseProgress = 30;
                const progressRange = 60; // 30% - 90%
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
        
        // 提取封面
        const musicId = path.basename(file.filename, path.extname(file.filename));
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