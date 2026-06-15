/**
 * 认证路由模块
 * 处理用户注册、登录、个人信息
 */

const express = require('express');
const router = express.Router();
const users = require('../database/users');
const { generateToken, authMiddleware } = require('../middleware/auth');

/**
 * 用户注册
 * POST /api/auth/register
 * body: { username, password, nickname }
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;

    // 参数校验
    if (!username || !password) {
      return res.json({ code: 1, msg: '用户名和密码不能为空', data: null });
    }
    if (username.length < 3 || username.length > 20) {
      return res.json({ code: 1, msg: '用户名长度需要3-20个字符', data: null });
    }
    if (password.length < 6 || password.length > 30) {
      return res.json({ code: 1, msg: '密码长度需要6-30个字符', data: null });
    }
    if (nickname && nickname.length > 20) {
      return res.json({ code: 1, msg: '昵称不能超过20个字符', data: null });
    }

    // 创建用户
    const user = await users.createUser(username, password, nickname);

    // 生成Token
    const token = generateToken(user.id);

    res.json({
      code: 0,
      msg: '注册成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
        },
      },
    });
  } catch (err) {
    res.json({ code: 1, msg: err.message || '注册失败', data: null });
  }
});

/**
 * 游客登录
 * POST /api/auth/guest
 * body: { nickname }
 */
router.post('/guest', async (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname || nickname.trim().length === 0) {
      return res.json({ code: 1, msg: '请输入昵称', data: null });
    }
    if (nickname.length > 20) {
      return res.json({ code: 1, msg: '昵称不能超过20个字符', data: null });
    }

    // 创建游客账号（随机用户名，1000金币）
    const guestName = 'guest_' + Date.now().toString(36);
    const user = await users.createUser(guestName, Math.random().toString(36), nickname.trim());
    const { setGold } = require('../database/users');
    setGold(user.id, 1000);

    const token = generateToken(user.id);

    res.json({
      code: 0,
      msg: '游客登录成功',
      data: {
        token,
        user: { id: user.id, username: guestName, nickname: nickname.trim(), gold: 1000, wins: 0, losses: 0, totalGames: 0 },
        isGuest: true,
      },
    });
  } catch (err) {
    res.json({ code: 1, msg: err.message || '登录失败', data: null });
  }
});

/**
 * 用户登录
 * POST /api/auth/login
 * body: { username, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 参数校验
    if (!username || !password) {
      return res.json({ code: 1, msg: '用户名和密码不能为空', data: null });
    }

    // 查找用户
    const user = await users.findByUsername(username);
    if (!user) {
      return res.json({ code: 1, msg: '用户名或密码错误', data: null });
    }

    // 检查封禁
    if (user.is_banned) {
      return res.json({ code: 1, msg: '账号已被封禁，请联系管理员', data: null });
    }

    // 验证密码
    const isValid = await users.verifyPassword(password, user.password);
    if (!isValid) {
      return res.json({ code: 1, msg: '用户名或密码错误', data: null });
    }

    // 更新登录时间
    await users.updateLastLogin(user.id);
    await users.updateOnlineStatus(user.id, true);

    // 生成Token
    const token = generateToken(user.id);

    res.json({
      code: 0,
      msg: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          gold: user.gold,
          wins: user.wins,
          losses: user.losses,
          totalGames: user.total_games,
        },
      },
    });
  } catch (err) {
    res.json({ code: 1, msg: err.message || '登录失败', data: null });
  }
});

/**
 * 获取个人信息
 * GET /api/auth/profile
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await users.findById(req.userId);
    if (!user) {
      return res.json({ code: 1, msg: '用户不存在', data: null });
    }

    res.json({
      code: 0,
      msg: 'success',
      data: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        gold: user.gold,
        wins: user.wins,
        losses: user.losses,
        totalGames: user.total_games,
        winRate: user.total_games > 0
          ? ((user.wins / user.total_games) * 100).toFixed(1) + '%'
          : '0%',
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    res.json({ code: 1, msg: '获取信息失败', data: null });
  }
});

/**
 * 修改昵称
 * PUT /api/auth/nickname
 * body: { nickname }
 */
router.put('/nickname', authMiddleware, async (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname || nickname.length > 20) {
      return res.json({ code: 1, msg: '昵称无效', data: null });
    }

    const db = require('../database/init').getDb();
    db.run('UPDATE users SET nickname = ? WHERE id = ?', [nickname, req.userId]);
    require('../database/init').saveDatabase();

    res.json({ code: 0, msg: '修改成功', data: { nickname } });
  } catch (err) {
    res.json({ code: 1, msg: '修改失败', data: null });
  }
});

module.exports = router;
