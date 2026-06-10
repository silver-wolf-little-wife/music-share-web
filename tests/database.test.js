/**
 * 测试 database.getMusicStats() 聚合统计方法
 */
const Database = require('../src/utils/database');

describe('Database - getMusicStats()', () => {
    let db;

    beforeAll(async () => {
        // 使用内存数据库，避免污染真实数据
        process.env.DB_PATH = ':memory:';
        // 重新加载模块以使用内存数据库
        jest.resetModules();
        db = require('../src/utils/database');
        await db.init();
    });

    afterAll(async () => {
        await db.close();
    });

    beforeEach(async () => {
        await db.clearAllMusic();
    });

    test('空数据库返回零值统计', async () => {
        const stats = await db.getMusicStats();
        expect(stats.totalCount).toBe(0);
        expect(stats.totalSize).toBe(0);
        expect(stats.totalDuration).toBe(0);
        expect(stats.formatBreakdown).toEqual([]);
    });

    test('插入多首歌曲后返回正确的聚合统计', async () => {
        await db.addMusic({
            id: 'song1.mp3', filename: 'song1.mp3',
            title: 'Song 1', artist: 'Artist A', album: 'Album X',
            year: 2024, genre: null, duration: 180.5, bitrate: 320000,
            format: 'MPEG', codec: 'MP3', size: 5000000,
            cover: null, lyrics: null, file_mtime: 1000
        });
        await db.addMusic({
            id: 'song2.flac', filename: 'song2.flac',
            title: 'Song 2', artist: 'Artist B', album: 'Album Y',
            year: 2024, genre: null, duration: 240.0, bitrate: 900000,
            format: 'FLAC', codec: 'FLAC', size: 25000000,
            cover: null, lyrics: null, file_mtime: 1000
        });
        await db.addMusic({
            id: 'song3.mp3', filename: 'song3.mp3',
            title: 'Song 3', artist: 'Artist C', album: 'Album Z',
            year: 2024, genre: null, duration: 300.0, bitrate: 320000,
            format: 'MPEG', codec: 'MP3', size: 8000000,
            cover: null, lyrics: null, file_mtime: 1000
        });

        const stats = await db.getMusicStats();

        expect(stats.totalCount).toBe(3);
        expect(stats.totalSize).toBe(5000000 + 25000000 + 8000000);
        expect(stats.totalDuration).toBe(Math.round(180.5 + 240.0 + 300.0));

        // 格式分布
        expect(stats.formatBreakdown.length).toBe(2); // MPEG + FLAC
        const mp3 = stats.formatBreakdown.find(f => f.format === 'MPEG');
        const flac = stats.formatBreakdown.find(f => f.format === 'FLAC');
        expect(mp3.count).toBe(2);
        expect(flac.count).toBe(1);
    });

    test('统计结果包含所有必要的字段', async () => {
        const stats = await db.getMusicStats();
        expect(stats).toHaveProperty('totalCount');
        expect(stats).toHaveProperty('totalSize');
        expect(stats).toHaveProperty('totalDuration');
        expect(stats).toHaveProperty('formatBreakdown');
        expect(Array.isArray(stats.formatBreakdown)).toBe(true);
    });
});
