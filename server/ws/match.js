/**
 * 匹配队列模块
 * 实现快速自动匹配系统
 */

const config = require('../config');

// 匹配队列
let matchQueue = [];
// 匹配检查定时器
let matchTimer = null;

/**
 * 添加玩家到匹配队列
 * @param {object} player - { userId, nickname, avatar, ws }
 * @returns {object} { success, position }
 */
function addToQueue(player) {
  // 检查是否已在队列中
  if (matchQueue.find(p => p.userId === player.userId)) {
    return { success: false, msg: '你已在匹配队列中' };
  }

  player.joinTime = Date.now();
  matchQueue.push(player);
  console.log(`[Match] ${player.nickname} 加入匹配队列, 当前 ${matchQueue.length}/3 人`);

  return { success: true, position: matchQueue.length };
}

/**
 * 从匹配队列移除玩家
 * @param {number} userId
 * @returns {boolean}
 */
function removeFromQueue(userId) {
  const index = matchQueue.findIndex(p => p.userId === userId);
  if (index !== -1) {
    matchQueue.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * 获取队列中的玩家数量
 * @returns {number}
 */
function getQueueSize() {
  return matchQueue.length;
}

/**
 * 检查是否可以匹配
 * @returns {Array|null} 匹配到的3个玩家，或null
 */
function checkMatch() {
  if (matchQueue.length >= 3) {
    // 取出前3个玩家
    const matched = matchQueue.splice(0, 3);
    return matched;
  }
  return null;
}

/**
 * 开始匹配检查定时器
 * @param {function} onMatch - 匹配成功回调
 */
function startMatchTimer(onMatch) {
  if (matchTimer) return;

  matchTimer = setInterval(() => {
    const matched = checkMatch();
    if (matched && onMatch) {
      onMatch(matched);
    }
  }, config.match.queueCheckInterval);
}

/**
 * 停止匹配检查定时器
 */
function stopMatchTimer() {
  if (matchTimer) {
    clearInterval(matchTimer);
    matchTimer = null;
  }
}

/**
 * 获取匹配队列状态
 * @returns {object}
 */
function getQueueStatus() {
  return {
    count: matchQueue.length,
    players: matchQueue.map(p => ({
      userId: p.userId,
      nickname: p.nickname,
      waitTime: Date.now() - p.joinTime,
    })),
  };
}

module.exports = {
  addToQueue,
  removeFromQueue,
  getQueueSize,
  checkMatch,
  startMatchTimer,
  stopMatchTimer,
  getQueueStatus,
};
