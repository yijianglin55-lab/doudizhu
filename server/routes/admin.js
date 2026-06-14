/**
 * 后台管理路由模块
 * 提供管理员后台的所有接口
 */

const express = require('express');
const router = express.Router();
const users = require('../database/users');
const rooms = require('../database/rooms');
const history = require('../database/history');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const config = require('../config');

// 所有后台接口都需要管理员权限
router.use(authMiddleware, adminMiddleware);

/**
 * 管理员登录（复用普通登录，这里提供验证接口）
 * GET /api/admin/check
 */
router.get('/check', (req, res) => {
  res.json({ code: 0, msg: '管理员已认证', data: { isAdmin: true } });
});

/**
 * 获取所有用户列表
 * GET /api/admin/users
 */
router.get('/users', async (req, res) => {
  try {
    const allUsers = await users.getAllUsers();
    res.json({
      code: 0,
      msg: 'success',
      data: allUsers.map(u => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar,
        gold: u.gold,
        wins: u.wins,
        losses: u.losses,
        totalGames: u.total_games,
        isOnline: !!u.is_online,
        isBanned: !!u.is_banned,
        lastLogin: u.last_login,
        createdAt: u.created_at,
      })),
    });
  } catch (err) {
    res.json({ code: 1, msg: '获取用户列表失败', data: null });
  }
});

/**
 * 获取在线用户列表
 * GET /api/admin/users/online
 */
router.get('/users/online', async (req, res) => {
  try {
    const onlineUsers = await users.getOnlineUsers();
    res.json({ code: 0, msg: 'success', data: onlineUsers });
  } catch (err) {
    res.json({ code: 1, msg: '获取在线用户失败', data: null });
  }
});

/**
 * 修改用户金币
 * PUT /api/admin/users/:id/gold
 * body: { gold }
 */
router.put('/users/:id/gold', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { gold } = req.body;

    if (typeof gold !== 'number' || gold < 0) {
      return res.json({ code: 1, msg: '金币数值无效', data: null });
    }

    await users.setGold(userId, gold);
    res.json({ code: 0, msg: '金币修改成功', data: { userId, gold } });
  } catch (err) {
    res.json({ code: 1, msg: '修改金币失败', data: null });
  }
});

/**
 * 封禁/解封用户
 * PUT /api/admin/users/:id/ban
 * body: { banned }
 */
router.put('/users/:id/ban', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { banned } = req.body;

    await users.setBanned(userId, banned);
    res.json({
      code: 0,
      msg: banned ? '封禁成功' : '解封成功',
      data: { userId, banned },
    });
  } catch (err) {
    res.json({ code: 1, msg: '操作失败', data: null });
  }
});

/**
 * 获取当前活跃房间
 * GET /api/admin/rooms
 */
router.get('/rooms', async (req, res) => {
  try {
    const activeRooms = await rooms.getActiveRooms();
    res.json({ code: 0, msg: 'success', data: activeRooms });
  } catch (err) {
    res.json({ code: 1, msg: '获取房间列表失败', data: null });
  }
});

/**
 * 获取历史对局记录
 * GET /api/admin/history
 * query: { limit, offset }
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const historyList = await history.getHistoryList(limit, offset);
    const total = await history.getTotalCount();

    res.json({
      code: 0,
      msg: 'success',
      data: {
        list: historyList,
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    res.json({ code: 1, msg: '获取历史记录失败', data: null });
  }
});

/**
 * 获取匹配配置
 * GET /api/admin/config/match
 */
router.get('/config/match', (req, res) => {
  res.json({
    code: 0,
    msg: 'success',
    data: {
      baseScore: config.game.baseScore,
      minGold: config.game.minGold,
      turnTimeout: config.game.turnTimeout,
      maxWaitTime: config.match.maxWaitTime,
    },
  });
});

/**
 * 修改匹配配置
 * PUT /api/admin/config/match
 * body: { baseScore, minGold, turnTimeout, maxWaitTime }
 */
router.put('/config/match', (req, res) => {
  try {
    const { baseScore, minGold, turnTimeout, maxWaitTime } = req.body;

    if (baseScore !== undefined) config.game.baseScore = baseScore;
    if (minGold !== undefined) config.game.minGold = minGold;
    if (turnTimeout !== undefined) config.game.turnTimeout = turnTimeout;
    if (maxWaitTime !== undefined) config.match.maxWaitTime = maxWaitTime;

    res.json({
      code: 0,
      msg: '配置已更新',
      data: {
        baseScore: config.game.baseScore,
        minGold: config.game.minGold,
        turnTimeout: config.game.turnTimeout,
        maxWaitTime: config.match.maxWaitTime,
      },
    });
  } catch (err) {
    res.json({ code: 1, msg: '更新配置失败', data: null });
  }
});

/**
 * 获取系统统计
 * GET /api/admin/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const allUsers = await users.getAllUsers();
    const onlineUsers = await users.getOnlineUsers();
    const activeRooms = await rooms.getActiveRooms();
    const totalGames = await history.getTotalCount();

    res.json({
      code: 0,
      msg: 'success',
      data: {
        totalUsers: allUsers.length,
        onlineUsers: onlineUsers.length,
        activeRooms: activeRooms.length,
        totalGames,
        bannedUsers: allUsers.filter(u => u.is_banned).length,
      },
    });
  } catch (err) {
    res.json({ code: 1, msg: '获取统计失败', data: null });
  }
});

module.exports = router;
