/**
 * 斗地主游戏逻辑模块
 * 管理一局游戏的完整流程：发牌→叫分→出牌→结算
 */

const { dealCards, sortCards, cardsToClient } = require('./deck');
const { identifyType, CARD_TYPE, getTypeMultiplier } = require('./cardType');
const { validatePlay, getHint } = require('./validator');

// 游戏状态枚举
const GAME_STATE = {
  WAITING: 'waiting',       // 等待玩家
  DEALING: 'dealing',       // 发牌中
  BIDDING: 'bidding',       // 叫分阶段
  PLAYING: 'playing',       // 出牌阶段
  FINISHED: 'finished',     // 游戏结束
};

/**
 * 创建游戏实例
 * @param {object} options
 * @returns {object} 游戏实例
 */
function createGame(options) {
  return {
    roomId: options.roomId,
    state: GAME_STATE.WAITING,
    players: [],              // 玩家列表 [{userId, nickname, avatar, handCards, isReady}]
    landlordIndex: -1,        // 地主玩家索引
    landlordCards: [],        // 底牌
    currentPlayerIndex: -1,   // 当前出牌玩家索引
    lastPlayCards: null,      // 上次出的牌
    lastPlayPlayerIndex: -1,  // 上次出牌的玩家索引
    passCount: 0,             // 连续不出次数
    baseScore: options.baseScore || 100, // 底分
    multiplier: 1,            // 倍数
    bombCount: 0,             // 炸弹数量
    isSpring: false,          // 是否春天
    bidding: {
      currentBidder: -1,     // 当前叫分者
      highestBid: 0,         // 最高叫分
      highestBidder: -1,     // 最高叫分者
      bids: [],              // 叫分记录
      requiredBids: 3,       // 需要叫分的人数
    },
    turnTimer: null,          // 出牌计时器
    startedAt: null,          // 开始时间
    turnStartTime: null,      // 当前回合开始时间
  };
}

/**
 * 添加玩家到游戏
 * @param {object} game - 游戏实例
 * @param {object} player - {userId, nickname, avatar}
 * @returns {boolean} 是否成功
 */
function addPlayer(game, player) {
  if (game.players.length >= 3) return false;
  if (game.players.find(p => p.userId === player.userId)) return false;

  game.players.push({
    userId: player.userId,
    nickname: player.nickname,
    avatar: player.avatar,
    handCards: [],
    isReady: false,
    isConnected: true,
  });

  return true;
}

/**
 * 移除玩家
 * @param {object} game
 * @param {number} userId
 */
function removePlayer(game, userId) {
  const index = game.players.findIndex(p => p.userId === userId);
  if (index !== -1) {
    game.players.splice(index, 1);
  }
}

/**
 * 玩家准备/取消准备
 * @param {object} game
 * @param {number} userId
 * @returns {boolean}
 */
function toggleReady(game, userId) {
  const player = game.players.find(p => p.userId === userId);
  if (!player) return false;
  player.isReady = !player.isReady;
  return player.isReady;
}

/**
 * 检查是否所有玩家都已准备
 * @param {object} game
 * @returns {boolean}
 */
function allReady(game) {
  return game.players.length === 3 && game.players.every(p => p.isReady);
}

/**
 * 开始游戏：发牌
 * @param {object} game
 * @returns {object} 发牌结果
 */
function startGame(game) {
  if (game.players.length !== 3) {
    return { success: false, msg: '需要3名玩家' };
  }

  const { players: hands, landlordCards } = dealCards();

  // 分配手牌
  game.players[0].handCards = hands[0];
  game.players[1].handCards = hands[1];
  game.players[2].handCards = hands[2];
  game.landlordCards = landlordCards;

  game.state = GAME_STATE.DEALING;
  game.startedAt = new Date().toLocaleString();

  // 随机选择第一个叫分者
  game.bidding.currentBidder = Math.floor(Math.random() * 3);
  game.bidding.highestBid = 0;
  game.bidding.highestBidder = -1;
  game.bidding.bids = [];

  return {
    success: true,
    hands: [
      cardsToClient(hands[0]),
      cardsToClient(hands[1]),
      cardsToClient(hands[2]),
    ],
    landlordCards: cardsToClient(landlordCards),
    firstBidder: game.bidding.currentBidder,
  };
}

/**
 * 叫分操作
 * @param {object} game
 * @param {number} playerIndex - 玩家索引
 * @param {number} score - 叫分（0=不叫，1/2/3=叫分）
 * @returns {object} 叫分结果
 */
function bid(game, playerIndex, score) {
  if (game.state !== GAME_STATE.BIDDING && game.state !== GAME_STATE.DEALING) {
    return { success: false, msg: '当前不是叫分阶段' };
  }

  if (playerIndex !== game.bidding.currentBidder) {
    return { success: false, msg: '还没轮到你叫分' };
  }

  // 验证叫分
  if (score < 0 || score > 3) {
    return { success: false, msg: '叫分无效' };
  }

  if (score > 0 && score <= game.bidding.highestBid) {
    return { success: false, msg: '叫分必须高于当前最高分' };
  }

  // 记录叫分
  game.bidding.bids.push({ playerIndex, score });
  game.state = GAME_STATE.BIDDING;

  if (score > 0) {
    game.bidding.highestBid = score;
    game.bidding.highestBidder = playerIndex;
  }

  // 叫3分直接成为地主
  if (score === 3) {
    return settleLandlord(game, playerIndex);
  }

  // 下一个叫分者
  game.bidding.currentBidder = (playerIndex + 1) % 3;

  // 所有人都叫过分
  if (game.bidding.bids.length >= 3) {
    if (game.bidding.highestBidder === -1) {
      // 无人叫分，第一个叫分者当地主（底分1）
      game.bidding.highestBid = 1;
      game.bidding.highestBidder = game.bidding.bids[0].playerIndex;
      return settleLandlord(game, game.bidding.highestBidder);
    }
    return settleLandlord(game, game.bidding.highestBidder);
  }

  return {
    success: true,
    action: 'next_bid',
    nextBidder: game.bidding.currentBidder,
    highestBid: game.bidding.highestBid,
  };
}

/**
 * 确定地主
 * @param {object} game
 * @param {number} landlordIndex
 * @returns {object}
 */
function settleLandlord(game, landlordIndex) {
  game.landlordIndex = landlordIndex;
  game.state = GAME_STATE.PLAYING;

  // 底牌给地主
  game.players[landlordIndex].handCards.push(...game.landlordCards);
  sortCards(game.players[landlordIndex].handCards);

  // 设置倍数
  game.multiplier = game.bidding.highestBid;

  // 地主先出牌
  game.currentPlayerIndex = landlordIndex;
  game.lastPlayCards = null;
  game.lastPlayPlayerIndex = -1;
  game.passCount = 0;

  return {
    success: true,
    action: 'landlord_settled',
    landlordIndex,
    landlordCards: cardsToClient(game.landlordCards),
    landlordHand: cardsToClient(game.players[landlordIndex].handCards),
    multiplier: game.multiplier,
    firstPlayer: landlordIndex,
  };
}

/**
 * 出牌操作
 * @param {object} game
 * @param {number} playerIndex - 出牌玩家索引
 * @param {Array} cardIds - 要出的牌ID列表
 * @returns {object} 出牌结果
 */
function playCards(game, playerIndex, cardIds) {
  if (game.state !== GAME_STATE.PLAYING) {
    return { success: false, msg: '当前不是出牌阶段' };
  }

  if (playerIndex !== game.currentPlayerIndex) {
    return { success: false, msg: '还没轮到你出牌' };
  }

  const player = game.players[playerIndex];

  // 根据ID找到对应的牌
  const playCards = [];
  for (const id of cardIds) {
    const card = player.handCards.find(c => c.id === id);
    if (!card) {
      return { success: false, msg: '手牌中没有这张牌' };
    }
    playCards.push(card);
  }

  // 判断是否自由出牌
  const isFreePlay = game.lastPlayCards === null || game.lastPlayPlayerIndex === playerIndex;

  // 验证出牌合法性
  const validation = validatePlay(
    playCards,
    isFreePlay ? null : game.lastPlayCards,
    player.handCards
  );

  if (!validation.valid) {
    return { success: false, msg: validation.msg };
  }

  // 从手牌中移除出的牌
  for (const card of playCards) {
    const index = player.handCards.findIndex(c => c.id === card.id);
    if (index !== -1) {
      player.handCards.splice(index, 1);
    }
  }

  // 更新游戏状态
  game.lastPlayCards = playCards;
  game.lastPlayPlayerIndex = playerIndex;
  game.passCount = 0;

  // 检查炸弹/王炸，更新倍数
  const typeInfo = identifyType(playCards);
  if (typeInfo.type === CARD_TYPE.BOMB) {
    game.bombCount++;
    game.multiplier *= 2;
  } else if (typeInfo.type === CARD_TYPE.ROCKET) {
    game.bombCount++;
    game.multiplier *= 2;
  }

  // 检查是否出完（胜利）
  if (player.handCards.length === 0) {
    return handleGameOver(game, playerIndex, typeInfo);
  }

  // 下一个玩家
  game.currentPlayerIndex = (playerIndex + 1) % 3;

  return {
    success: true,
    action: 'play',
    cards: cardsToClient(playCards),
    cardType: typeInfo.type,
    typeName: require('./cardType').TYPE_NAMES[typeInfo.type],
    nextPlayer: game.currentPlayerIndex,
    remainingCards: player.handCards.length,
    multiplier: game.multiplier,
  };
}

/**
 * 不出（PASS）
 * @param {object} game
 * @param {number} playerIndex
 * @returns {object}
 */
function pass(game, playerIndex) {
  if (game.state !== GAME_STATE.PLAYING) {
    return { success: false, msg: '当前不是出牌阶段' };
  }

  if (playerIndex !== game.currentPlayerIndex) {
    return { success: false, msg: '还没轮到你' };
  }

  // 自由出牌不能不出
  if (game.lastPlayCards === null || game.lastPlayPlayerIndex === playerIndex) {
    return { success: false, msg: '你是首出，必须出牌' };
  }

  game.passCount++;

  // 两人都不出，轮回到首出者自由出牌
  if (game.passCount >= 2) {
    game.lastPlayCards = null;
    game.passCount = 0;
  }

  game.currentPlayerIndex = (playerIndex + 1) % 3;

  return {
    success: true,
    action: 'pass',
    nextPlayer: game.currentPlayerIndex,
    passCount: game.passCount,
  };
}

/**
 * 获取提示
 * @param {object} game
 * @param {number} playerIndex
 * @returns {Array|null}
 */
function getCardHint(game, playerIndex) {
  const player = game.players[playerIndex];
  const isFreePlay = game.lastPlayCards === null || game.lastPlayPlayerIndex === playerIndex;
  return getHint(player.handCards, isFreePlay ? null : game.lastPlayCards);
}

/**
 * 处理游戏结束
 * @param {object} game
 * @param {number} winnerIndex - 赢家索引
 * @param {object} lastType - 最后出的牌型
 * @returns {object}
 */
function handleGameOver(game, winnerIndex, lastType) {
  game.state = GAME_STATE.FINISHED;

  const landlordWin = winnerIndex === game.landlordIndex;
  const winner = game.players[winnerIndex];

  // 检查春天
  // 地主春天：地主出完牌，两个农民都没出过牌
  // 反春天：农民出完牌，地主只出过一手牌
  let isSpring = false;
  if (landlordWin) {
    // 检查两个农民是否都没出过牌（手牌数量还是17张）
    const farmers = game.players.filter((_, i) => i !== game.landlordIndex);
    isSpring = farmers.every(p => p.handCards.length === 17);
  } else {
    // 检查地主是否只出了一手牌（手牌数量还是19张）
    isSpring = game.players[game.landlordIndex].handCards.length === 19;
  }

  if (isSpring) {
    game.isSpring = true;
    game.multiplier *= 2;
  }

  // 计算分数
  const scores = calculateScores(game, landlordWin);

  return {
    success: true,
    action: 'game_over',
    winnerIndex,
    winnerName: winner.nickname,
    landlordWin,
    isSpring,
    multiplier: game.multiplier,
    bombCount: game.bombCount,
    scores,
    landlordCards: cardsToClient(game.landlordCards),
  };
}

/**
 * 计算分数
 * @param {object} game
 * @param {boolean} landlordWin
 * @returns {Array} 每个玩家的分数变化
 */
function calculateScores(game, landlordWin) {
  const base = game.baseScore * game.multiplier;
  const scores = [];

  for (let i = 0; i < 3; i++) {
    if (i === game.landlordIndex) {
      scores.push(landlordWin ? base * 2 : -base * 2);
    } else {
      scores.push(landlordWin ? -base : base);
    }
  }

  return scores;
}

/**
 * 获取游戏状态（发送给客户端）
 * @param {object} game
 * @param {number} userId - 请求的用户ID
 * @returns {object}
 */
function getGameState(game, userId) {
  const playerIndex = game.players.findIndex(p => p.userId === userId);
  const player = game.players[playerIndex];

  return {
    state: game.state,
    players: game.players.map((p, i) => ({
      userId: p.userId,
      nickname: p.nickname,
      avatar: p.avatar,
      handCount: p.handCards.length,
      isReady: p.isReady,
      isConnected: p.isConnected,
      isLandlord: i === game.landlordIndex,
      isCurrent: i === game.currentPlayerIndex,
    })),
    myIndex: playerIndex,
    myCards: player ? cardsToClient(player.handCards) : [],
    landlordIndex: game.landlordIndex,
    landlordCards: (game.state === GAME_STATE.PLAYING || game.state === GAME_STATE.FINISHED) ? cardsToClient(game.landlordCards) : [],
    currentPlayerIndex: game.currentPlayerIndex,
    lastPlayCards: game.lastPlayCards ? cardsToClient(game.lastPlayCards) : null,
    lastPlayPlayerIndex: game.lastPlayPlayerIndex,
    multiplier: game.multiplier,
    baseScore: game.baseScore,
    bombCount: game.bombCount,
    bidding: game.bidding,
  };
}

module.exports = {
  GAME_STATE,
  createGame,
  addPlayer,
  removePlayer,
  toggleReady,
  allReady,
  startGame,
  bid,
  playCards,
  pass,
  getCardHint,
  getGameState,
  calculateScores,
};
