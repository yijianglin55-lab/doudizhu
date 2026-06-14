/**
 * 用户数据模块
 * 使用sql.js的同步API
 */

const { getDb, saveDatabase } = require('./init');
const bcrypt = require('bcryptjs');

/**
 * 执行查询并返回所有行
 */
function all(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * 执行查询并返回一行
 */
function get(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

/**
 * 执行写操作
 */
function run(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  saveDatabase();
}

/**
 * 创建新用户
 */
async function createUser(username, password, nickname) {
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    const db = getDb();
    db.run(
      'INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)',
      [username, hashedPassword, nickname || username]
    );
    saveDatabase();
    const user = get('SELECT id, username, nickname FROM users WHERE username = ?', [username]);
    return user;
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      throw new Error('用户名已存在');
    }
    throw err;
  }
}

/**
 * 根据用户名查找用户
 */
function findByUsername(username) {
  return get('SELECT * FROM users WHERE username = ?', [username]);
}

/**
 * 根据ID查找用户
 */
function findById(id) {
  return get('SELECT * FROM users WHERE id = ?', [id]);
}

/**
 * 验证密码
 */
function verifyPassword(password, hashedPassword) {
  return bcrypt.compareSync(password, hashedPassword);
}

/**
 * 更新在线状态
 */
function updateOnlineStatus(userId, isOnline) {
  run('UPDATE users SET is_online = ?, updated_at = datetime("now", "localtime") WHERE id = ?', [isOnline ? 1 : 0, userId]);
}

/**
 * 更新金币
 */
function updateGold(userId, amount) {
  const db = getDb();
  db.run('UPDATE users SET gold = gold + ?, updated_at = datetime("now", "localtime") WHERE id = ?', [amount, userId]);
  saveDatabase();
  const user = get('SELECT gold FROM users WHERE id = ?', [userId]);
  return user ? user.gold : 0;
}

/**
 * 更新战绩
 */
function updateStats(userId, isWin) {
  const field = isWin ? 'wins' : 'losses';
  run(`UPDATE users SET ${field} = ${field} + 1, total_games = total_games + 1, updated_at = datetime("now", "localtime") WHERE id = ?`, [userId]);
}

/**
 * 封禁/解封用户
 */
function setBanned(userId, banned) {
  run('UPDATE users SET is_banned = ?, updated_at = datetime("now", "localtime") WHERE id = ?', [banned ? 1 : 0, userId]);
}

/**
 * 获取所有用户
 */
function getAllUsers() {
  return all('SELECT id, username, nickname, avatar, gold, wins, losses, total_games, is_online, is_banned, last_login, created_at FROM users ORDER BY id');
}

/**
 * 获取在线用户
 */
function getOnlineUsers() {
  return all('SELECT id, username, nickname, avatar, gold, is_online FROM users WHERE is_online = 1');
}

/**
 * 更新最后登录时间
 */
function updateLastLogin(userId) {
  run('UPDATE users SET last_login = datetime("now", "localtime") WHERE id = ?', [userId]);
}

/**
 * 设置金币（管理员用）
 */
function setGold(userId, gold) {
  run('UPDATE users SET gold = ?, updated_at = datetime("now", "localtime") WHERE id = ?', [gold, userId]);
}

module.exports = {
  createUser,
  findByUsername,
  findById,
  verifyPassword,
  updateOnlineStatus,
  updateGold,
  updateStats,
  setBanned,
  getAllUsers,
  getOnlineUsers,
  updateLastLogin,
  setGold,
};
