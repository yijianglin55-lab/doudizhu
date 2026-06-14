/**
 * 结算模块
 * 处理对局结束后的金币结算和战绩更新
 */

const users = require('../database/users');
const history = require('../database/history');

/**
 * 处理对局结算
 * @param {object} game - 游戏实例
 * @param {object} result - 对局结果
 * @returns {object} 结算详情
 */
async function processSettlement(game, result) {
  const { scores, landlordWin, isSpring, multiplier, bombCount } = result;
  const settlement = {
    players: [],
    historyId: null,
  };

  // 更新每个玩家的金币和战绩
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    const score = scores[i];
    const isWin = score > 0;

    try {
      // 更新金币
      const newGold = await users.updateGold(player.userId, score);

      // 更新战绩
      await users.updateStats(player.userId, isWin);

      settlement.players.push({
        userId: player.userId,
        nickname: player.nickname,
        score,
        newGold,
        isWin,
      });
    } catch (err) {
      console.error(`结算玩家 ${player.userId} 失败:`, err);
      settlement.players.push({
        userId: player.userId,
        nickname: player.nickname,
        score,
        newGold: 0,
        isWin,
        error: '结算失败',
      });
    }
  }

  // 保存对局记录
  try {
    const historyId = await history.saveGameHistory({
      room_id: game.roomId,
      player1_id: game.players[0]?.userId,
      player2_id: game.players[1]?.userId,
      player3_id: game.players[2]?.userId,
      landlord_id: game.players[game.landlordIndex]?.userId,
      winner_id: game.players[result.winnerIndex]?.userId,
      base_score: game.baseScore,
      multiplier,
      bomb_count: bombCount,
      spring: isSpring ? 1 : 0,
      player1_score: scores[0],
      player2_score: scores[1],
      player3_score: scores[2],
      started_at: game.startedAt,
    });
    settlement.historyId = historyId;
  } catch (err) {
    console.error('保存对局记录失败:', err);
  }

  return settlement;
}

/**
 * 获取玩家个人信息（含胜率）
 * @param {number} userId
 * @returns {object}
 */
async function getPlayerProfile(userId) {
  const user = await users.findById(userId);
  if (!user) return null;

  return {
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
  };
}

/**
 * 获取排行榜
 * @param {string} type - gold/wins/winrate
 * @param {number} limit
 * @returns {Array}
 */
async function getLeaderboard(type, limit) {
  const db = require('../database/init').getDb();
  let orderBy;

  switch (type) {
    case 'gold':
      orderBy = 'gold DESC';
      break;
    case 'wins':
      orderBy = 'wins DESC';
      break;
    case 'winrate':
      orderBy = 'CASE WHEN total_games > 0 THEN wins * 1.0 / total_games ELSE 0 END DESC';
      break;
    default:
      orderBy = 'gold DESC';
  }

  const stmt = db.prepare(
    `SELECT id, nickname, avatar, gold, wins, losses, total_games
     FROM users WHERE is_banned = 0 ORDER BY ${orderBy} LIMIT ?`
  );
  stmt.bind([limit || 10]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  return rows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    nickname: row.nickname,
    avatar: row.avatar,
    gold: row.gold,
    wins: row.wins,
    losses: row.losses,
    totalGames: row.total_games,
    winRate: row.total_games > 0
      ? ((row.wins / row.total_games) * 100).toFixed(1) + '%'
      : '0%',
  }));
}

module.exports = {
  processSettlement,
  getPlayerProfile,
  getLeaderboard,
};
