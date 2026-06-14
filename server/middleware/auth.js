/**
 * 认证中间件
 * 处理用户登录状态验证和权限检查
 */

const { getDb } = require('../database/init');
const config = require('../config');

/**
 * 简易Token生成
 */
function generateToken(userId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2);
  return Buffer.from(`${userId}:${timestamp}:${random}:${config.auth.secret}`).toString('base64');
}

/**
 * 解析Token获取用户ID
 */
function parseToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const parts = decoded.split(':');
    if (parts.length >= 4 && parts[3] === config.auth.secret) {
      return parseInt(parts[0]);
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 查询单行（sql.js API）
 */
function dbGet(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

/**
 * HTTP请求认证中间件
 */
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ code: 401, msg: '未登录，请先登录', data: null });
  }

  const userId = parseToken(token);
  if (!userId) {
    return res.status(401).json({ code: 401, msg: 'Token无效或已过期', data: null });
  }

  req.userId = userId;
  next();
}

/**
 * 管理员权限中间件
 */
function adminMiddleware(req, res, next) {
  const row = dbGet('SELECT username FROM users WHERE id = ?', [req.userId]);
  if (!row) {
    return res.status(403).json({ code: 403, msg: '权限不足', data: null });
  }
  if (row.username !== 'admin') {
    return res.status(403).json({ code: 403, msg: '需要管理员权限', data: null });
  }
  next();
}

/**
 * WebSocket认证
 */
function authenticateWS(token) {
  return parseToken(token);
}

module.exports = {
  generateToken,
  parseToken,
  authMiddleware,
  adminMiddleware,
  authenticateWS,
};
