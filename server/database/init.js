/**
 * 数据库初始化模块
 * 使用sql.js（纯JavaScript SQLite实现），无需C++编译
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// 数据库实例
let db = null;
let dbPath = null;

/**
 * 获取数据库实例
 */
function getDb() {
  return db;
}

/**
 * 保存数据库到文件
 */
function saveDatabase() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('保存数据库失败:', err.message);
  }
}

/**
 * 定时保存数据库（每30秒）
 */
let saveTimer = null;
function startAutoSave() {
  if (saveTimer) clearInterval(saveTimer);
  saveTimer = setInterval(saveDatabase, 30000);
}

/**
 * 初始化数据库
 */
async function initDatabase() {
  dbPath = path.resolve(__dirname, '..', config.database.path);

  // 确保data目录存在
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 初始化sql.js
  const SQL = await initSqlJs();

  // 如果数据库文件已存在，加载它
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // 创建表结构
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      avatar TEXT DEFAULT 'default.png',
      gold INTEGER DEFAULT 10000,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      total_games INTEGER DEFAULT 0,
      is_online INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      last_login TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT UNIQUE NOT NULL,
      owner_id INTEGER NOT NULL,
      password TEXT DEFAULT '',
      status TEXT DEFAULT 'waiting',
      max_players INTEGER DEFAULT 3,
      current_players INTEGER DEFAULT 0,
      base_score INTEGER DEFAULT 100,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS game_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER,
      player1_id INTEGER,
      player2_id INTEGER,
      player3_id INTEGER,
      landlord_id INTEGER,
      winner_id INTEGER,
      base_score INTEGER,
      multiplier INTEGER,
      bomb_count INTEGER DEFAULT 0,
      spring INTEGER DEFAULT 0,
      player1_score INTEGER DEFAULT 0,
      player2_score INTEGER DEFAULT 0,
      player3_score INTEGER DEFAULT 0,
      cards_record TEXT DEFAULT '',
      started_at TEXT,
      ended_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      room_id INTEGER DEFAULT NULL,
      hand_cards TEXT DEFAULT '[]',
      is_disconnected INTEGER DEFAULT 0,
      disconnected_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 创建默认管理员
  await createDefaultAdmin();

  // 保存并启动自动保存
  saveDatabase();
  startAutoSave();

  console.log('数据库初始化完成');
}

/**
 * 创建默认管理员账号
 */
async function createDefaultAdmin() {
  const bcrypt = require('bcryptjs');
  const adminConfig = config.admin;

  const stmt = db.prepare('SELECT id FROM users WHERE username = ?');
  stmt.bind([adminConfig.username]);
  const hasRow = stmt.step();
  stmt.free();

  if (!hasRow) {
    const hashedPassword = bcrypt.hashSync(adminConfig.password, 10);
    db.run(
      'INSERT INTO users (username, password, nickname, gold) VALUES (?, ?, ?, ?)',
      [adminConfig.username, hashedPassword, '管理员', 999999]
    );
    console.log('默认管理员账号已创建:', adminConfig.username);
  }
}

module.exports = {
  getDb,
  initDatabase,
  saveDatabase,
};
