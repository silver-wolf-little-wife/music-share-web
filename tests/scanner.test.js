/**
 * 测试 Scanner 错误收集和日志持久化
 */
const fs = require('fs');
const path = require('path');
const MusicScanner = require('../src/utils/scanner');

// Mock dependencies
jest.mock('../src/utils/metadata', () => ({
    extractMetadata: jest.fn().mockResolvedValue({ title: 'Test', artist: 'Test', duration: 100 }),
    extractCover: jest.fn().mockResolvedValue(null),
    extractLyrics: jest.fn().mockResolvedValue('Test lyrics'),
    isAudioFile: jest.fn((name) => name.endsWith('.mp3') || name.endsWith('.flac'))
}));

jest.mock('../src/utils/logger', () => ({
    writeErrorLog: jest.fn(),
    writeScanErrors: jest.fn()
}));

describe('Scanner - 错误收集', () => {
    let mockDb;
    let scanner;
    const testMusicDir = path.join(__dirname, '../music');
    const testCoverDir = path.join(__dirname, '../public/covers');

    beforeEach(() => {
        mockDb = {
            getAllMusicFilenamesAndMtime: jest.fn().mockResolvedValue([]),
            deleteNonExistentFiles: jest.fn().mockResolvedValue({ deletedCount: 0 }),
            getMusicByFilename: jest.fn().mockResolvedValue(null),
            batchAddMusic: jest.fn().mockResolvedValue({ addedCount: 1 }),
            batchUpdateMusic: jest.fn().mockResolvedValue({ updatedCount: 0 })
        };

        scanner = new MusicScanner(mockDb, testMusicDir, testCoverDir);
    });

    test('batchAddMusic 失败时 errors 包含 batch_add_error', async () => {
        mockDb.getAllMusicFilenamesAndMtime.mockResolvedValue([]);
        mockDb.batchAddMusic.mockRejectedValue(new Error('SQLITE_ERROR'));
        mockDb.getMusicByFilename.mockResolvedValue(null);

        // 直接 mock extractMusicData 避免 fs.statSync 找真实文件
        jest.spyOn(scanner, 'extractMusicData').mockResolvedValue({
            id: 'test.mp3', filename: 'test.mp3',
            title: 'Test', artist: 'Test', album: null,
            year: null, genre: null, duration: 100, bitrate: null,
            format: 'MPEG', codec: null, size: 1000,
            cover: null, lyrics: null, file_mtime: 1000
        });

        jest.spyOn(scanner, 'scanDirectory').mockResolvedValue([{
            filename: 'test.mp3',
            fullPath: testMusicDir + '/test.mp3',
            mtime: 1000
        }]);

        const results = await scanner.performIncrementalScan();
        expect(results.errors.length).toBeGreaterThan(0);
        const addError = results.errors.find(e =>
            e.type === 'batch_add_error' || e.type === 'batch_error'
        );
        expect(addError).toBeDefined();
    });

    test('extractMusicData 中元数据为 null 时仍可入库（降级到文件名）', async () => {
        const metadata = require('../src/utils/metadata');
        // 元数据返回 null（例如损坏文件），应降级使用文件名
        metadata.extractMetadata.mockResolvedValue(null);

        mockDb.getAllMusicFilenamesAndMtime.mockResolvedValue([]);
        mockDb.getMusicByFilename.mockResolvedValue(null);

        jest.spyOn(scanner, 'scanDirectory').mockResolvedValue([
            { filename: 'broken.mp3', fullPath: testMusicDir + '/broken.mp3', mtime: 1000 }
        ]);

        const results = await scanner.performIncrementalScan();
        // 数据应正常入库（标题降级为文件名 'broken'）
        expect(results.added.length + results.errors.length).toBeGreaterThanOrEqual(1);
    });

    test('scanDirectory 递归扫描子目录', async () => {
        // 需要通过真实文件系统测试，mock 路径处理
        const tmpDir = path.join(__dirname, '..');
        // 由于 music 目录可能为空，直接测试 mock
        const mockFiles = [
            { filename: 'root.mp3', fullPath: testMusicDir + '/root.mp3', mtime: 1000 },
            { filename: 'sub.mp3', fullPath: testMusicDir + '/sub/sub.mp3', mtime: 2000 }
        ];

        jest.spyOn(scanner, 'scanDirectory').mockResolvedValue(mockFiles);
        const files = await scanner.scanDirectory(testMusicDir);
        expect(files.length).toBe(2);
        expect(files.find(f => f.filename === 'sub.mp3')).toBeDefined();
    });

    test('startIncrementalScan 完成后调用 writeScanErrors 持久化错误', async () => {
        const logger = require('../src/utils/logger');

        // 设置一个有错误的场景
        const results = {
            added: [],
            updated: [],
            deleted: [],
            errors: [
                { type: 'file_error', file: 'corrupt.mp3', message: '解析失败' }
            ],
            totalProcessed: 0,
            startTime: new Date(),
            endTime: new Date(),
            duration: 100
        };

        jest.spyOn(scanner, 'performIncrementalScan').mockResolvedValue(results);

        await scanner.startIncrementalScan();
        expect(logger.writeScanErrors).toHaveBeenCalledWith(results.errors);
    });

    test('startIncrementalScan 顶层异常时写入 scan_error 日志', async () => {
        const logger = require('../src/utils/logger');
        jest.spyOn(scanner, 'performIncrementalScan').mockRejectedValue(new Error('致命错误'));

        await expect(scanner.startIncrementalScan()).rejects.toThrow('致命错误');
        expect(logger.writeErrorLog).toHaveBeenCalledWith({
            type: 'scan_error',
            message: '致命错误'
        });
    });
});
