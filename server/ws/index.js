/**
 * WebSocket通信模块
 * 处理所有实时通信：匹配、房间、游戏对局
 */

const WebSocket = require('ws');
const { authenticateWS } = require('../middleware/auth');
const users = require('../database/users');
const rooms = require('../database/rooms');
const landlord = require('../game/landlord');
const settlement = require('../game/settlement');
const match = require('./match');
const config = require('../config');

// 在线连接池：userId -> { ws, user, gameId, roomId }
const connections = new Map();

// 活跃游戏实例：roomId -> game
const activeGames = new Map();

// 断线重连数据：userId -> { roomId, timeout }
const disconnectedPlayers = new Map();

/**
 * 初始化WebSocket服务器
 * @param {WebSocket.Server} wss
 */
function initWebSocket(wss) {
  // 启动匹配定时器
  match.startMatchTimer(onMatchFound);

  // 启动断线重连检查
  setInterval(checkDisconnectedPlayers, config.reconnect.checkInterval);

  wss.on('connection', (ws, req) => {
    console.log('新的WebSocket连接');

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleMessage(ws, message);
      } catch (err) {
        sendToWs(ws, 'error', { msg: '消息格式错误' });
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket错误:', err.message);
    });
  });

  // 心跳检测
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
}

/**
 * 处理收到的消息
 */
function handleMessage(ws, message) {
  const { type, data, token } = message;

  // 登录认证
  if (type === 'auth') {
    return handleAuth(ws, data);
  }

  // 以下所有消息需要认证
  if (!ws.userId) {
    return sendToWs(ws, 'error', { msg: '请先登录' });
  }

  switch (type) {
    case 'join_match':
      return handleJoinMatch(ws);
    case 'leave_match':
      return handleLeaveMatch(ws);
    case 'create_room':
      return handleCreateRoom(ws, data);
    case 'join_room':
      return handleJoinRoom(ws, data);
    case 'leave_room':
      return handleLeaveRoom(ws);
    case 'ready':
      return handleReady(ws);
    case 'start_game':
      return handleStartGame(ws);
    case 'bid':
      return handleBid(ws, data);
    case 'play':
      return handlePlay(ws, data);
    case 'pass':
      return handlePass(ws);
    case 'hint':
      return handleHint(ws);
    case 'chat':
      return handleChat(ws, data);
    case 'kick_player':
      return handleKickPlayer(ws, data);
    case 'dissolve_room':
      return handleDissolveRoom(ws);
    default:
      sendToWs(ws, 'error', { msg: '未知消息类型' });
  }
}

/**
 * 处理认证
 */
async function handleAuth(ws, data) {
  const { token } = data;
  const userId = authenticateWS(token);

  if (!userId) {
    return sendToWs(ws, 'auth_result', { success: false, msg: 'Token无效' });
  }

  console.log(`[Auth] 用户 ${userId} 开始认证`);

  try {
    const user = await users.findById(userId);
    if (!user) {
      return sendToWs(ws, 'auth_result', { success: false, msg: '用户不存在' });
    }
    if (user.is_banned) {
      return sendToWs(ws, 'auth_result', { success: false, msg: '账号已被封禁' });
    }

    // ===== 关键：查找并处理旧连接 =====
    let existingRoomId = null;
    let existingGame = null;

    // 1. 从断线数据恢复
    const reconnectData = disconnectedPlayers.get(userId);
    if (reconnectData) {
      disconnectedPlayers.delete(userId);
      existingRoomId = reconnectData.roomId;
      console.log(`[Auth] 用户 ${userId} 从断线数据恢复, roomId=${existingRoomId}`);
    }

    // 2. 从旧连接恢复（页面跳转场景：新连接先到，旧连接还没断）
    const oldConn = connections.get(userId);
    if (oldConn) {
      if (oldConn.roomId && !existingRoomId) {
        existingRoomId = oldConn.roomId;
        console.log(`[Auth] 用户 ${userId} 从旧连接恢复, roomId=${existingRoomId}`);
      }
      // 关闭旧连接（标记intentionalClose防止客户端重连）
      if (oldConn.ws) {
        oldConn.ws.intentionalClose = true;
        try { oldConn.ws.close(); } catch (e) {}
      }
    }

    // 3. 从活跃游戏中查找（兜底）
    if (!existingRoomId) {
      for (const [roomId, game] of activeGames) {
        if (game.players.find(p => p.userId === userId)) {
          existingRoomId = roomId;
          break;
        }
      }
      if (existingRoomId) {
        console.log(`[Auth] 用户 ${userId} 从活跃游戏恢复, roomId=${existingRoomId}`);
      }
    }

    // 查找游戏实例
    if (existingRoomId) {
      existingGame = activeGames.get(existingRoomId);
      if (existingGame) {
        const player = existingGame.players.find(p => p.userId === userId);
        if (player) {
          player.isConnected = true;
        }
      } else {
        existingRoomId = null; // 游戏不存在了
      }
    }

    ws.userId = userId;
    ws.user = user;

    // 记录新连接
    connections.set(userId, { ws, user, gameId: null, roomId: existingRoomId });

    // 更新在线状态
    try { users.updateOnlineStatus(userId, true); } catch (e) {}

    console.log(`[Auth] 用户 ${userId} 认证完成, roomId=${existingRoomId}`);

    // 恢复游戏状态
    let gameState = null;
    if (existingGame) {
      gameState = landlord.getGameState(existingGame, userId);
      console.log(`[Auth] 用户 ${userId} 恢复到房间 ${existingRoomId}`);
    }

    sendToWs(ws, 'auth_result', {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        gold: user.gold,
      },
      gameState,
    });

    // 广播在线人数更新
    broadcastOnlineCount();

  } catch (err) {
    sendToWs(ws, 'auth_result', { success: false, msg: '认证失败' });
  }
}

/**
 * 处理加入匹配
 */
function handleJoinMatch(ws) {
  const conn = connections.get(ws.userId);
  if (conn.roomId) {
    return sendToWs(ws, 'error', { msg: '你已在房间中' });
  }

  const result = match.addToQueue({
    userId: ws.userId,
    nickname: ws.user.nickname,
    avatar: ws.user.avatar,
    ws,
  });

  sendToWs(ws, 'match_result', result);
}

/**
 * 处理离开匹配
 */
function handleLeaveMatch(ws) {
  match.removeFromQueue(ws.userId);
  sendToWs(ws, 'match_left', { success: true });
}

/**
 * 匹配成功回调
 */
async function onMatchFound(matchedPlayers) {
  try {
    console.log(`[Match] 匹配成功! 玩家: ${matchedPlayers.map(p => p.nickname).join(', ')}`);

    // 创建房间
    const room = await rooms.createRoom(matchedPlayers[0].userId, '', config.game.baseScore);
    console.log(`[Match] 房间已创建: ${room.room_code} (ID: ${room.id})`);

    // 创建游戏实例
    const game = landlord.createGame({
      roomId: room.id,
      baseScore: config.game.baseScore,
    });

    // 添加玩家
    for (const player of matchedPlayers) {
      landlord.addPlayer(game, {
        userId: player.userId,
        nickname: player.nickname,
        avatar: player.avatar,
      });

      // 更新连接信息
      const conn = connections.get(player.userId);
      if (conn) {
        conn.roomId = room.id;
        // 不自动标记准备，需要玩家手动准备
      }
    }

    // 保存游戏实例
    activeGames.set(room.id, game);

    // 通知所有匹配到的玩家
    for (const player of matchedPlayers) {
      const conn = connections.get(player.userId);
      if (conn && conn.ws) {
        sendToWs(conn.ws, 'match_success', {
          roomId: room.id,
          roomCode: room.room_code,
          gameState: landlord.getGameState(game, player.userId),
        });
      }
    }

    // 不再自动开始游戏，等待玩家手动准备

  } catch (err) {
    console.error('匹配创建房间失败:', err);
  }
}

/**
 * 处理创建房间
 */
async function handleCreateRoom(ws, data) {
  const conn = connections.get(ws.userId);
  if (conn.roomId) {
    return sendToWs(ws, 'error', { msg: '你已在房间中' });
  }

  try {
    const { password, baseScore } = data || {};
    const room = await rooms.createRoom(ws.userId, password, baseScore);

    const game = landlord.createGame({
      roomId: room.id,
      baseScore: baseScore || config.game.baseScore,
    });

    landlord.addPlayer(game, {
      userId: ws.userId,
      nickname: ws.user.nickname,
      avatar: ws.user.avatar,
    });

    activeGames.set(room.id, game);
    conn.roomId = room.id;

    sendToWs(ws, 'room_created', {
      roomId: room.id,
      roomCode: room.room_code,
      gameState: landlord.getGameState(game, ws.userId),
    });
  } catch (err) {
    sendToWs(ws, 'error', { msg: '创建房间失败' });
  }
}

/**
 * 处理加入房间
 */
async function handleJoinRoom(ws, data) {
  const conn = connections.get(ws.userId);
  if (conn.roomId) {
    return sendToWs(ws, 'error', { msg: '你已在房间中' });
  }

  const { roomCode, password } = data || {};
  if (!roomCode) {
    return sendToWs(ws, 'error', { msg: '请输入房间号' });
  }

  try {
    const room = await rooms.findByCode(roomCode);
    if (!room) {
      return sendToWs(ws, 'error', { msg: '房间不存在' });
    }

    if (room.password && room.password !== password) {
      return sendToWs(ws, 'error', { msg: '房间密码错误' });
    }

    if (room.current_players >= 3) {
      return sendToWs(ws, 'error', { msg: '房间已满' });
    }

    if (room.status === 'playing') {
      return sendToWs(ws, 'error', { msg: '游戏已开始' });
    }

    const game = activeGames.get(room.id);
    if (!game) {
      return sendToWs(ws, 'error', { msg: '游戏实例不存在' });
    }

    const added = landlord.addPlayer(game, {
      userId: ws.userId,
      nickname: ws.user.nickname,
      avatar: ws.user.avatar,
    });

    if (!added) {
      return sendToWs(ws, 'error', { msg: '加入房间失败' });
    }

    conn.roomId = room.id;
    await rooms.updatePlayerCount(room.id, game.players.length);

    // 通知房间内所有人
    broadcastToRoom(room.id, 'player_joined', {
      userId: ws.userId,
      nickname: ws.user.nickname,
      gameState: landlord.getGameState(game, ws.userId),
    });

    sendToWs(ws, 'room_joined', {
      roomId: room.id,
      roomCode: room.room_code,
      gameState: landlord.getGameState(game, ws.userId),
    });
  } catch (err) {
    sendToWs(ws, 'error', { msg: '加入房间失败' });
  }
}

/**
 * 处理离开房间
 */
function handleLeaveRoom(ws) {
  const conn = connections.get(ws.userId);
  if (!conn) { return sendToWs(ws, 'error', { msg: '连接异常' }); }
  if (!conn.roomId) { return sendToWs(ws, 'error', { msg: '你不在任何房间中' }); }

  const game = activeGames.get(conn.roomId);
  if (!game) {
    conn.roomId = null;
    return;
  }

  // 游戏中不能离开
  if (game.state === landlord.GAME_STATE.PLAYING || game.state === landlord.GAME_STATE.BIDDING) {
    return sendToWs(ws, 'error', { msg: '游戏进行中，无法离开' });
  }

  const roomId = conn.roomId;
  landlord.removePlayer(game, ws.userId);
  conn.roomId = null;

  // 如果房间空了，删除
  if (game.players.length === 0) {
    activeGames.delete(roomId);
    rooms.deleteRoom(roomId);
  } else {
    rooms.updatePlayerCount(roomId, game.players.length);
    broadcastToRoom(roomId, 'player_left', {
      userId: ws.userId,
      gameState: landlord.getGameState(game, ws.userId),
    });
  }

  sendToWs(ws, 'room_left', { success: true });
}

/**
 * 处理准备
 */
function handleReady(ws) {
  const conn = connections.get(ws.userId);
  if (!conn) { return sendToWs(ws, 'error', { msg: '连接异常' }); }
  if (!conn.roomId) { return sendToWs(ws, 'error', { msg: '你不在任何房间中' }); }

  const game = activeGames.get(conn.roomId);
  if (!game) { return sendToWs(ws, 'error', { msg: '房间不存在' }); }

  const isReady = landlord.toggleReady(game, ws.userId);

  broadcastToRoom(conn.roomId, 'player_ready', {
    userId: ws.userId,
    isReady,
    gameState: landlord.getGameState(game, ws.userId),
  });
}

/**
 * 处理开始游戏
 */
function handleStartGame(ws) {
  const conn = connections.get(ws.userId);
  if (!conn.roomId) return;

  const game = activeGames.get(conn.roomId);
  if (!game) return;

  // 检查是否房主
  const room = game.players[0];
  if (room.userId !== ws.userId) {
    return sendToWs(ws, 'error', { msg: '只有房主可以开始游戏' });
  }

  if (!landlord.allReady(game)) {
    return sendToWs(ws, 'error', { msg: '还有玩家未准备' });
  }

  startGameForRoom(game, conn.roomId);
}

/**
 * 自动开始游戏（匹配模式）
 */
function autoStartGame(game, roomId) {
  if (game.players.length === 3) {
    startGameForRoom(game, roomId);
  }
}

/**
 * 开始游戏
 */
function startGameForRoom(game, roomId) {
  const result = landlord.startGame(game);
  if (!result.success) {
    broadcastToRoom(roomId, 'error', { msg: result.msg });
    return;
  }

  // 通知每个玩家发牌结果
  game.players.forEach((player, index) => {
    const conn = connections.get(player.userId);
    if (conn && conn.ws) {
      sendToWs(conn.ws, 'game_started', {
        hands: result.hands[index],
        landlordCards: [], // 底牌暂时不发
        firstBidder: result.firstBidder,
        gameState: landlord.getGameState(game, player.userId),
      });
    }
  });

  // 开始叫分
  broadcastToRoom(roomId, 'bidding_start', {
    firstBidder: result.firstBidder,
    timeout: BID_TIMEOUT,
  });

  // 启动叫分超时计时
  startBidTimer(game, roomId);
}

// 叫分超时定时器
const bidTimers = new Map();
const BID_TIMEOUT = 15000;

function startBidTimer(game, roomId) {
  if (bidTimers.has(roomId)) clearTimeout(bidTimers.get(roomId));
  const timer = setTimeout(() => {
    bidTimers.delete(roomId);
    if (game.state !== landlord.GAME_STATE.BIDDING && game.state !== landlord.GAME_STATE.DEALING) return;
    const bidder = game.bidding.currentBidder;
    const player = game.players[bidder];
    if (!player) return;
    console.log(`[Bid] ${player.nickname} 叫分超时，自动不叫`);
    const result = landlord.bid(game, bidder, 0);
    if (!result.success) return;
    broadcastToRoom(roomId, 'bid_result', { playerIndex: bidder, score: 0, ...result, autoSkip: true });
    handleBidResult(game, roomId, result);
  }, BID_TIMEOUT);
  bidTimers.set(roomId, timer);
}

function handleBidResult(game, roomId, result) {
  if (result.action === 'landlord_settled') {
    if (bidTimers.has(roomId)) { clearTimeout(bidTimers.get(roomId)); bidTimers.delete(roomId); }
    setTimeout(() => {
      game.players.forEach((player) => {
        const pConn = connections.get(player.userId);
        if (pConn && pConn.ws) {
          sendToWs(pConn.ws, 'play_start', {
            landlordIndex: result.landlordIndex,
            firstPlayer: result.firstPlayer,
            multiplier: result.multiplier,
            landlordCards: result.landlordCards,
            gameState: landlord.getGameState(game, player.userId),
            playTimeout: PLAY_TIMEOUT,
          });
        }
      });
      // 启动出牌计时
      startPlayTimer(game, roomId);
    }, 1500);
  }
  if (result.action === 'next_bid') {
    startBidTimer(game, roomId);
  }
}

function handleBid(ws, data) {
  const conn = connections.get(ws.userId);
  if (!conn.roomId) return;
  const game = activeGames.get(conn.roomId);
  if (!game) return;
  const playerIndex = game.players.findIndex(p => p.userId === ws.userId);
  const result = landlord.bid(game, playerIndex, data.score);
  if (!result.success) return sendToWs(ws, 'error', { msg: result.msg });
  broadcastToRoom(conn.roomId, 'bid_result', { playerIndex, score: data.score, ...result });
  handleBidResult(game, conn.roomId, result);
}

// 出牌超时定时器
const playTimers = new Map();
const PLAY_TIMEOUT = 20000;

function startPlayTimer(game, roomId) {
  if (playTimers.has(roomId)) clearTimeout(playTimers.get(roomId));
  const timer = setTimeout(() => {
    playTimers.delete(roomId);
    if (game.state !== landlord.GAME_STATE.PLAYING) return;
    const playerIndex = game.currentPlayerIndex;
    const player = game.players[playerIndex];
    if (!player) return;
    console.log(`[Play] ${player.nickname} 出牌超时`);

    // 可以不出就不出
    const canPass = game.lastPlayCards !== null && game.lastPlayPlayerIndex !== playerIndex;
    if (canPass) {
      const result = landlord.pass(game, playerIndex);
      if (result.success) {
        broadcastToRoom(roomId, 'player_pass', { playerIndex, ...result, autoPass: true });
        startPlayTimer(game, roomId);
        return;
      }
    }
    // 必须出牌（自由出牌），出最小单张
    if (player.handCards.length > 0) {
      const result = landlord.playCards(game, playerIndex, [player.handCards[0].id]);
      if (result.success) {
        broadcastToRoom(roomId, 'card_played', { playerIndex, ...result, autoPlay: true });
        if (result.action === 'game_over') { handleGameOver(game, roomId, result); return; }
        startPlayTimer(game, roomId);
      }
    }
  }, PLAY_TIMEOUT);
  playTimers.set(roomId, timer);
}

/**
 * 处理出牌
 */
function handlePlay(ws, data) {
  const conn = connections.get(ws.userId);
  if (!conn.roomId) return;

  const game = activeGames.get(conn.roomId);
  if (!game) return;

  const playerIndex = game.players.findIndex(p => p.userId === ws.userId);
  const result = landlord.playCards(game, playerIndex, data.cardIds);

  if (!result.success) {
    return sendToWs(ws, 'error', { msg: result.msg });
  }

  // 清除出牌定时器
  if (playTimers.has(conn.roomId)) { clearTimeout(playTimers.get(conn.roomId)); playTimers.delete(conn.roomId); }

  broadcastToRoom(conn.roomId, 'card_played', { playerIndex, ...result });

  if (result.action === 'game_over') {
    handleGameOver(game, conn.roomId, result);
  } else {
    startPlayTimer(game, conn.roomId);
  }
}

/**
 * 处理不出
 */
function handlePass(ws) {
  const conn = connections.get(ws.userId);
  if (!conn.roomId) return;

  const game = activeGames.get(conn.roomId);
  if (!game) return;

  const playerIndex = game.players.findIndex(p => p.userId === ws.userId);
  const result = landlord.pass(game, playerIndex);

  if (!result.success) {
    return sendToWs(ws, 'error', { msg: result.msg });
  }

  if (playTimers.has(conn.roomId)) { clearTimeout(playTimers.get(conn.roomId)); playTimers.delete(conn.roomId); }

  broadcastToRoom(conn.roomId, 'player_pass', { playerIndex, ...result });

  startPlayTimer(game, conn.roomId);
}

/**
 * 处理提示请求
 */
function handleHint(ws) {
  const conn = connections.get(ws.userId);
  if (!conn.roomId) return;

  const game = activeGames.get(conn.roomId);
  if (!game) return;

  const playerIndex = game.players.findIndex(p => p.userId === ws.userId);
  const hint = landlord.getCardHint(game, playerIndex);

  sendToWs(ws, 'hint_result', {
    cards: hint,
  });
}

/**
 * 处理聊天
 */
function handleChat(ws, data) {
  const conn = connections.get(ws.userId);
  if (!conn.roomId) return;

  broadcastToRoom(conn.roomId, 'chat_message', {
    userId: ws.userId,
    nickname: ws.user.nickname,
    message: data.message,
  });
}

/**
 * 处理踢人
 */
function handleKickPlayer(ws, data) {
  const conn = connections.get(ws.userId);
  if (!conn.roomId) return;

  const game = activeGames.get(conn.roomId);
  if (!game) return;

  // 只有房主可以踢人
  if (game.players[0].userId !== ws.userId) {
    return sendToWs(ws, 'error', { msg: '只有房主可以踢人' });
  }

  const targetUserId = data.userId;
  if (targetUserId === ws.userId) {
    return sendToWs(ws, 'error', { msg: '不能踢自己' });
  }

  const targetConn = connections.get(targetUserId);
  if (targetConn) {
    targetConn.roomId = null;
    sendToWs(targetConn.ws, 'kicked', { msg: '你已被房主踢出房间' });
  }

  landlord.removePlayer(game, targetUserId);
  rooms.updatePlayerCount(conn.roomId, game.players.length);

  broadcastToRoom(conn.roomId, 'player_kicked', {
    userId: targetUserId,
    gameState: landlord.getGameState(game, ws.userId),
  });
}

/**
 * 处理解散房间
 */
function handleDissolveRoom(ws) {
  const conn = connections.get(ws.userId);
  if (!conn.roomId) return;

  const game = activeGames.get(conn.roomId);
  if (!game) return;

  // 只有房主可以解散
  if (game.players[0].userId !== ws.userId) {
    return sendToWs(ws, 'error', { msg: '只有房主可以解散房间' });
  }

  const roomId = conn.roomId;

  // 通知所有人
  broadcastToRoom(roomId, 'room_dissolved', { msg: '房间已解散' });

  // 清理
  game.players.forEach(p => {
    const playerConn = connections.get(p.userId);
    if (playerConn) {
      playerConn.roomId = null;
    }
  });

  activeGames.delete(roomId);
  rooms.deleteRoom(roomId);
}

/**
 * 处理游戏结束
 */
async function handleGameOver(game, roomId, result) {
  try {
    const settleResult = await settlement.processSettlement(game, result);

    broadcastToRoom(roomId, 'game_over', {
      ...result,
      settlement: settleResult,
    });

    // 重置游戏状态
    game.state = landlord.GAME_STATE.WAITING;
    game.landlordIndex = -1;
    game.currentPlayerIndex = -1;
    game.lastPlayCards = null;
    game.multiplier = 1;
    game.bombCount = 0;
    game.isSpring = false;
    game.players.forEach(p => {
      p.handCards = [];
      p.isReady = false;
    });

    // 更新房间状态
    rooms.updateStatus(roomId, 'waiting');
  } catch (err) {
    console.error('游戏结算失败:', err);
  }
}

/**
 * 处理断线
 */
function handleDisconnect(ws) {
  if (!ws.userId) return;

  const conn = connections.get(ws.userId);

  // 关键：如果当前连接已经不是这个ws了，或者被标记为主动关闭，不要处理
  if (!conn || conn.ws !== ws || ws.intentionalClose) {
    return;
  }

  // 在匹配队列中，移除
  match.removeFromQueue(ws.userId);

  // 在房间中
  if (conn.roomId) {
    const game = activeGames.get(conn.roomId);
    if (game) {
      const player = game.players.find(p => p.userId === ws.userId);
      if (player) {
        player.isConnected = false;
      }

      // 设置断线重连宽限期
      disconnectedPlayers.set(ws.userId, {
        roomId: conn.roomId,
        timeout: Date.now() + config.reconnect.maxOfflineTime,
      });

      // 通知其他人
      broadcastToRoom(conn.roomId, 'player_disconnected', {
        userId: ws.userId,
      });
    }
  }

  // 只有当前连接确实是这个ws时才删除
  connections.delete(ws.userId);
  try { users.updateOnlineStatus(ws.userId, false); } catch (e) {}
  broadcastOnlineCount();

  console.log(`用户 ${ws.userId} 断开连接`);
}

/**
 * 检查断线重连超时
 */
function checkDisconnectedPlayers() {
  const now = Date.now();
  for (const [userId, data] of disconnectedPlayers) {
    if (now > data.timeout) {
      disconnectedPlayers.delete(userId);
      const game = activeGames.get(data.roomId);
      if (game) {
        landlord.removePlayer(game, userId);
        broadcastToRoom(data.roomId, 'player_left', { userId });
        if (game.players.length === 0) {
          activeGames.delete(data.roomId);
          rooms.deleteRoom(data.roomId);
        }
      }
    }
  }
}

/**
 * 发送消息给指定WebSocket
 */
function sendToWs(ws, event, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data }));
  }
}

/**
 * 广播消息给房间内所有玩家
 */
function broadcastToRoom(roomId, event, data) {
  const game = activeGames.get(roomId);
  if (!game) return;

  game.players.forEach(player => {
    const conn = connections.get(player.userId);
    if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      // 对于gameState，需要为每个玩家生成各自的视角
      if (data.gameState) {
        const personalizedData = {
          ...data,
          gameState: landlord.getGameState(game, player.userId),
        };
        conn.ws.send(JSON.stringify({ event, data: personalizedData }));
      } else {
        conn.ws.send(JSON.stringify({ event, data }));
      }
    }
  });
}

/**
 * 广播在线人数
 */
function broadcastOnlineCount() {
  const count = connections.size;
  for (const [, conn] of connections) {
    if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      sendToWs(conn.ws, 'online_count', { count });
    }
  }
}

module.exports = {
  initWebSocket,
  connections,
  activeGames,
};
