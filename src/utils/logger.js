const fs = require('fs');
const path = require('path');

// 日志目录和文件路径
const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'scan-errors.log');

// 确保日志目录存在
function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

/**
 * 写入一条扫描错误日志
 * 每行一条 JSON，包含 timestamp、type、filename（可选）、message
 * @param {Object} entry - { type, filename?, message }
 */
function writeErrorLog(entry) {
    try {
        ensureLogDir();
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: entry.type || 'unknown',
            filename: entry.filename || null,
            message: entry.message || ''
        };
        fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf-8');
    } catch (err) {
        // 写入日志本身失败时仅输出到控制台，避免连锁故障
        console.error('写入错误日志失败:', err.message);
    }
}

/**
 * 批量写入扫描错误日志
 * @param {Array} errors - results.errors 数组
 */
function writeScanErrors(errors) {
    if (!errors || errors.length === 0) return;
    for (const err of errors) {
        writeErrorLog({
            type: err.type || 'unknown',
            filename: err.file || (err.files && err.files.length ? err.files.join(', ') : null),
            message: err.message || JSON.stringify(err)
        });
    }
    console.log(`已记录 ${errors.length} 条错误到日志文件`);
}

module.exports = { writeErrorLog, writeScanErrors };
