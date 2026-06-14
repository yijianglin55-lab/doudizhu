/**
 * 房间路由模块
 * 处理房间相关的HTTP接口
 */

const express = require('express');
const router = express.Router();
const rooms = require('../database/rooms');
const { authMiddleware } = require('../middleware/auth');

/**
 * 获取等待中的房间列表
 * GET /api/rooms/list
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const roomList = await rooms.getWaitingRooms();
    res.json({
      code: 0,
      msg: 'success',
      data: roomList.map(r => ({
        id: r.id,
        roomCode: r.room_code,
        ownerId: r.owner_id,
        hasPassword: !!r.password,
        currentPlayers: r.current_players,
        maxPlayers: r.max_players,
        baseScore: r.base_score,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    res.json({ code: 1, msg: '获取房间列表失败', data: null });
  }
});

/**
 * 获取活跃房间列表
 * GET /api/rooms/active
 */
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const activeRooms = await rooms.getActiveRooms();
    res.json({
      code: 0,
      msg: 'success',
      data: activeRooms.map(r => ({
        id: r.id,
        roomCode: r.room_code,
        status: r.status,
        currentPlayers: r.current_players,
        baseScore: r.base_score,
      })),
    });
  } catch (err) {
    res.json({ code: 1, msg: '获取活跃房间失败', data: null });
  }
});

module.exports = router;
