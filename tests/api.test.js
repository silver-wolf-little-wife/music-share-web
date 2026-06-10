/**
 * 测试 GET /api/music/stats API 端点
 */
const request = require('supertest');

// Mock auth middleware - 总是通过认证
jest.mock('../src/middleware/auth', () => ({
    apiAuthMiddleware: (req, res, next) => next(),
    authMiddleware: (req, res, next) => next()
}));

// Mock CSP middleware
jest.mock('../src/middleware/csp', () => (req, res, next) => next());

// Mock express-session
jest.mock('express-session', () => {
    return (options) => (req, res, next) => next();
});

// Mock serve-favicon
jest.mock('serve-favicon', () => (path) => (req, res, next) => next());

// 创建 mock database
const mockGetMusicStats = jest.fn();
const mockInit = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/utils/database', () => ({
    init: mockInit,
    getMusicStats: mockGetMusicStats,
    getAllMusic: jest.fn().mockResolvedValue([])
}));

jest.mock('../src/utils/scanner', () => {
    return jest.fn().mockImplementation(() => ({
        startIncrementalScan: jest.fn().mockResolvedValue({
            added: [], updated: [], deleted: [], errors: [],
            totalProcessed: 0, duration: 0
        })
    }));
});

// Mock favicon
jest.mock('serve-favicon', () => {
    return () => (req, res, next) => next();
});

describe('API - GET /api/music/stats', () => {
    let app;

    beforeAll(() => {
        // 确保 NODE_ENV 为 test，避免 app.js 启动扫描
        process.env.NODE_ENV = 'test';
        process.env.SESSION_SECRET = 'test-secret';
        // 重写 app.js 中的 listen 调用
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // 使用 jest.mock 模拟所有依赖后 require app
        app = require('../app');

        // Mock listen 方法，防止 app.js 底部调用 app.listen
        jest.spyOn(app, 'listen').mockImplementation((port, host, callback) => {
            if (typeof callback === 'function') callback();
            return { close: jest.fn() };
        });
    });

    afterAll(() => {
        console.log.mockRestore();
        console.error.mockRestore();
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        mockGetMusicStats.mockReset();
        mockInit.mockReset();
        mockInit.mockResolvedValue(undefined);
    });

    test('返回 200 和统计对象', async () => {
        mockGetMusicStats.mockResolvedValue({
            totalCount: 10,
            totalSize: 50000000,
            totalDuration: 3600,
            formatBreakdown: [
                { format: 'MPEG', count: 7 },
                { format: 'FLAC', count: 3 }
            ]
        });

        const res = await request(app)
            .get('/api/music/stats')
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.stats.totalCount).toBe(10);
        expect(res.body.stats.totalSize).toBe(50000000);
        expect(res.body.stats.totalDuration).toBe(3600);
        expect(res.body.stats.formatBreakdown.length).toBe(2);
    });

    test('数据库异常时返回 500', async () => {
        mockGetMusicStats.mockRejectedValue(new Error('数据库连接失败'));

        const res = await request(app)
            .get('/api/music/stats')
            .expect(500);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toBeDefined();
    });

    test('空库返回零值统计', async () => {
        mockGetMusicStats.mockResolvedValue({
            totalCount: 0,
            totalSize: 0,
            totalDuration: 0,
            formatBreakdown: []
        });

        const res = await request(app)
            .get('/api/music/stats')
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.stats.totalCount).toBe(0);
        expect(res.body.stats.formatBreakdown).toEqual([]);
    });

    test('响应包含所有必需字段', async () => {
        mockGetMusicStats.mockResolvedValue({
            totalCount: 5,
            totalSize: 1000,
            totalDuration: 120,
            formatBreakdown: [{ format: 'MPEG', count: 5 }]
        });

        const res = await request(app)
            .get('/api/music/stats');

        expect(res.body.success).toBe(true);
        const stats = res.body.stats;
        expect(stats).toHaveProperty('totalCount');
        expect(stats).toHaveProperty('totalSize');
        expect(stats).toHaveProperty('totalDuration');
        expect(stats).toHaveProperty('formatBreakdown');
        expect(Array.isArray(stats.formatBreakdown)).toBe(true);
    });
});
