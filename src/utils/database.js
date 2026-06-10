const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 数据库文件路径（支持环境变量覆盖，方便 Docker 挂载）
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../music.db');

class Database {
    constructor() {
        this.db = null;
    }

    // 初始化数据库连接
    init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('数据库连接失败:', err.message);
                    reject(err);
                } else {
                    console.log('数据库连接成功');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    // 创建数据表
    createTables() {
        return new Promise((resolve, reject) => {
            const createMusicTable = `
                CREATE TABLE IF NOT EXISTS music (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    title TEXT,
                    artist TEXT,
                    album TEXT,
                    year INTEGER,
                    genre TEXT,
                    duration REAL,
                    bitrate INTEGER,
                    format TEXT,
                    codec TEXT,
                    size INTEGER,
                    cover TEXT,
                    lyrics TEXT,
                    file_mtime INTEGER,
                    upload_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            this.db.run(createMusicTable, (err) => {
                if (err) {
                    console.error('创建数据表失败:', err.message);
                    reject(err);
                } else {
                    console.log('数据表创建成功');
                    // 检查是否需要添加 file_mtime 字段（用于现有数据库的升级）
                    this.checkAndAddFileMtimeColumn().then(resolve).catch(reject);
                }
            });
        });
    }

    // 检查并添加 file_mtime 字段（用于数据库升级）
    checkAndAddFileMtimeColumn() {
        return new Promise((resolve, reject) => {
            // 检查表结构
            this.db.all("PRAGMA table_info(music)", [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const hasFileMtime = rows.some(row => row.name === 'file_mtime');
                
                if (!hasFileMtime) {
                    // 添加 file_mtime 字段
                    this.db.run("ALTER TABLE music ADD COLUMN file_mtime INTEGER", (err) => {
                        if (err) {
                            console.error('添加 file_mtime 字段失败:', err.message);
                            // 如果字段已存在，忽略错误继续执行
                            if (err.message.includes('duplicate column name')) {
                                console.log('file_mtime 字段已存在，跳过添加');
                                resolve();
                            } else {
                                reject(err);
                            }
                        } else {
                            console.log('file_mtime 字段添加成功');
                            resolve();
                        }
                    });
                } else {
                    console.log('file_mtime 字段已存在，跳过添加');
                    resolve();
                }
            });
        });
    }

    // 添加音乐记录
    addMusic(musicData) {
        return new Promise((resolve, reject) => {
            const { id, filename, title, artist, album, year, genre, duration, bitrate, format, codec, size, cover, lyrics } = musicData;
            
            const sql = `
                INSERT INTO music (id, filename, title, artist, album, year, genre, duration, bitrate, format, codec, size, cover, lyrics)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(sql, [id, filename, title, artist, album, year, genre, duration, bitrate, format, codec, size, cover, lyrics], function(err) {
                if (err) {
                    console.error('添加音乐记录失败:', err.message);
                    reject(err);
                } else {
                    console.log(`音乐记录添加成功: ${title}`);
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    // 获取所有音乐记录
    getAllMusic() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM music ORDER BY upload_time DESC';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('获取音乐列表失败:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // 根据ID获取音乐记录
    getMusicById(id) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM music WHERE id = ?';
            
            this.db.get(sql, [id], (err, row) => {
                if (err) {
                    console.error('获取音乐记录失败:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // 搜索音乐记录
    searchMusic(keyword) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM music 
                WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
                ORDER BY upload_time DESC
            `;
            const searchTerm = `%${keyword}%`;
            
            this.db.all(sql, [searchTerm, searchTerm, searchTerm], (err, rows) => {
                if (err) {
                    console.error('搜索音乐失败:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // 删除音乐记录
    deleteMusic(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM music WHERE id = ?';
            
            this.db.run(sql, [id], function(err) {
                if (err) {
                    console.error('删除音乐记录失败:', err.message);
                    reject(err);
                } else {
                    console.log(`音乐记录删除成功: ${id}`);
                    resolve({ deletedCount: this.changes });
                }
            });
        });
    }

    // 更新音乐记录
    updateMusic(id, updateData) {
        return new Promise((resolve, reject) => {
            const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
            const values = Object.values(updateData);
            values.push(id);
            
            const sql = `UPDATE music SET ${fields} WHERE id = ?`;
            
            this.db.run(sql, values, function(err) {
                if (err) {
                    console.error('更新音乐记录失败:', err.message);
                    reject(err);
                } else {
                    console.log(`音乐记录更新成功: ${id}`);
                    resolve({ updatedCount: this.changes });
                }
            });
        });
    }

    // 关闭数据库连接
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('关闭数据库连接失败:', err.message);
                        reject(err);
                    } else {
                        console.log('数据库连接已关闭');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // 清空所有音乐记录
    clearAllMusic() {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM music';
            
            this.db.run(sql, [], function(err) {
                if (err) {
                    console.error('清空音乐记录失败:', err.message);
                    reject(err);
                } else {
                    console.log('音乐记录已清空');
                    resolve({ deletedCount: this.changes });
                }
            });
        });
    }

    // 获取音乐记录总数
    getMusicCount() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT COUNT(*) as count FROM music';
            
            this.db.get(sql, [], (err, row) => {
                if (err) {
                    console.error('获取音乐记录总数失败:', err.message);
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    // 根据文件名获取音乐记录
    getMusicByFilename(filename) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM music WHERE filename = ?';
            
            this.db.get(sql, [filename], (err, row) => {
                if (err) {
                    console.error('根据文件名获取音乐记录失败:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // 批量添加音乐记录
    batchAddMusic(musicArray) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR IGNORE INTO music (id, filename, title, artist, album, year, genre, duration, bitrate, format, codec, size, cover, lyrics, file_mtime)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                let completed = 0;
                let hasError = false;

                musicArray.forEach(music => {
                    const { id, filename, title, artist, album, year, genre, duration, bitrate, format, codec, size, cover, lyrics, file_mtime } = music;
                    
                    stmt.run([id, filename, title, artist, album, year, genre, duration, bitrate, format, codec, size, cover, lyrics, file_mtime], (err) => {
                        if (err) {
                            console.error('批量添加音乐记录失败:', err.message);
                            hasError = true;
                        }
                        
                        completed++;
                        if (completed === musicArray.length) {
                            stmt.finalize();
                            
                            if (hasError) {
                                this.db.run('ROLLBACK', () => {
                                    reject(new Error('批量添加过程中发生错误'));
                                });
                            } else {
                                this.db.run('COMMIT', (err) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        console.log(`批量添加 ${musicArray.length} 条音乐记录成功`);
                                        resolve({ addedCount: musicArray.length });
                                    }
                                });
                            }
                        }
                    });
                });
            });
        });
    }

    // 批量更新音乐记录
    batchUpdateMusic(updateArray) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE music SET title = ?, artist = ?, album = ?, year = ?, genre = ?, 
                duration = ?, bitrate = ?, format = ?, codec = ?, size = ?, cover = ?, lyrics = ?, file_mtime = ?
                WHERE id = ?
            `);

            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                let completed = 0;
                let hasError = false;

                updateArray.forEach(music => {
                    const { id, title, artist, album, year, genre, duration, bitrate, format, codec, size, cover, lyrics, file_mtime } = music;
                    
                    stmt.run([title, artist, album, year, genre, duration, bitrate, format, codec, size, cover, lyrics, file_mtime, id], (err) => {
                        if (err) {
                            console.error('批量更新音乐记录失败:', err.message);
                            hasError = true;
                        }
                        
                        completed++;
                        if (completed === updateArray.length) {
                            stmt.finalize();
                            
                            if (hasError) {
                                this.db.run('ROLLBACK', () => {
                                    reject(new Error('批量更新过程中发生错误'));
                                });
                            } else {
                                this.db.run('COMMIT', (err) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        console.log(`批量更新 ${updateArray.length} 条音乐记录成功`);
                                        resolve({ updatedCount: updateArray.length });
                                    }
                                });
                            }
                        }
                    });
                });
            });
        });
    }

    // 删除不存在的文件记录
    deleteNonExistentFiles(existingFilenames) {
        return new Promise((resolve, reject) => {
            if (!existingFilenames || existingFilenames.length === 0) {
                // 如果没有现有文件，删除所有记录
                const sql = 'DELETE FROM music';
                this.db.run(sql, [], function(err) {
                    if (err) {
                        console.error('删除所有音乐记录失败:', err.message);
                        reject(err);
                    } else {
                        console.log(`删除所有音乐记录成功: ${this.changes} 条`);
                        resolve({ deletedCount: this.changes });
                    }
                });
                return;
            }

            const placeholders = existingFilenames.map(() => '?').join(',');
            const sql = `DELETE FROM music WHERE filename NOT IN (${placeholders})`;
            
            this.db.run(sql, existingFilenames, function(err) {
                if (err) {
                    console.error('删除不存在文件的音乐记录失败:', err.message);
                    reject(err);
                } else {
                    console.log(`删除不存在文件的音乐记录成功: ${this.changes} 条`);
                    resolve({ deletedCount: this.changes });
                }
            });
        });
    }

    // 更新文件修改时间
    updateFileMtime(id, mtime) {
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE music SET file_mtime = ? WHERE id = ?';
            
            this.db.run(sql, [mtime, id], function(err) {
                if (err) {
                    console.error('更新文件修改时间失败:', err.message);
                    reject(err);
                } else {
                    resolve({ updatedCount: this.changes });
                }
            });
        });
    }

    // 获取所有音乐文件的文件名和修改时间
    getAllMusicFilenamesAndMtime() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT id, filename, file_mtime FROM music';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('获取音乐文件名和修改时间失败:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

// 创建数据库实例
const database = new Database();

module.exports = database;