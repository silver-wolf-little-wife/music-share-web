/**
 * 测试 logger 日志工具
 */
const fs = require('fs');
const path = require('path');

describe('Logger', () => {
    const logsDir = path.join(__dirname, '../logs');
    const logFile = path.join(logsDir, 'scan-errors.log');

    beforeEach(() => {
        if (fs.existsSync(logFile)) {
            fs.unlinkSync(logFile);
        }
    });

    afterAll(() => {
        if (fs.existsSync(logFile)) {
            fs.unlinkSync(logFile);
        }
    });

    test('writeErrorLog 写入一条 JSON 行到日志文件', () => {
        const logger = require('../src/utils/logger');
        logger.writeErrorLog({
            type: 'file_error',
            filename: 'test.mp3',
            message: '处理文件失败: ENOENT'
        });

        expect(fs.existsSync(logFile)).toBe(true);
        const content = fs.readFileSync(logFile, 'utf-8').trim();
        const entry = JSON.parse(content);

        expect(entry.type).toBe('file_error');
        expect(entry.filename).toBe('test.mp3');
        expect(entry.message).toBe('处理文件失败: ENOENT');
        expect(entry.timestamp).toBeDefined();
        expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    });

    test('writeErrorLog 自动创建 logs 目录', () => {
        const logger = require('../src/utils/logger');
        logger.writeErrorLog({ type: 'scan_error', message: '测试错误' });
        expect(fs.existsSync(logsDir)).toBe(true);
        expect(fs.existsSync(logFile)).toBe(true);
    });

    test('writeScanErrors 批量写入多条错误', () => {
        const logger = require('../src/utils/logger');
        const errors = [
            { type: 'file_error', file: 'a.mp3', message: 'err1' },
            { type: 'file_error', file: 'b.flac', message: 'err2' },
            { type: 'batch_error', message: 'batch failed', files: ['c.mp3'] }
        ];
        logger.writeScanErrors(errors);

        const content = fs.readFileSync(logFile, 'utf-8').trim();
        expect(content.split('\n').length).toBe(3);
    });

    test('writeScanErrors 空数组不产生日志', () => {
        const logger = require('../src/utils/logger');
        logger.writeScanErrors([]);
        expect(fs.existsSync(logFile)).toBe(false);
    });
});
