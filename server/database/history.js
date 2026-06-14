/**
 * 对局记录模块
 */

const { getDb, saveDatabase } = require('./init');

function all(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

function run(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  saveDatabase();
}

function saveGameHistory(data) {
  const db = getDb();
  db.run(
    `INSERT INTO game_history
     (room_id, player1_id, player2_id, player3_id, landlord_id, winner_id,
      base_score, multiplier, bomb_count, spring,
      player1_score, player2_score, player3_score, cards_record, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.room_id, data.player1_id, data.player2_id, data.player3_id,
      data.landlord_id, data.winner_id, data.base_score, data.multiplier,
      data.bomb_count || 0, data.spring || 0,
      data.player1_score || 0, data.player2_score || 0, data.player3_score || 0,
      data.cards_record || '', data.started_at || new Date().toLocaleString(),
    ]
  );
  saveDatabase();
  // 用条件查询获取刚插入的记录
  const row = get('SELECT id FROM game_history WHERE room_id = ? ORDER BY id DESC LIMIT 1', [data.room_id]);
  return row ? row.id : 0;
}

function getHistoryList(limit, offset) {
  return all(
    `SELECT h.*,
            u1.nickname as player1_name,
            u2.nickname as player2_name,
            u3.nickname as player3_name
     FROM game_history h
     LEFT JOIN users u1 ON h.player1_id = u1.id
     LEFT JOIN users u2 ON h.player2_id = u2.id
     LEFT JOIN users u3 ON h.player3_id = u3.id
     ORDER BY h.ended_at DESC
     LIMIT ? OFFSET ?`,
    [limit || 50, offset || 0]
  );
}

function getUserHistory(userId, limit) {
  return all(
    `SELECT h.*,
            u1.nickname as player1_name,
            u2.nickname as player2_name,
            u3.nickname as player3_name
     FROM game_history h
     LEFT JOIN users u1 ON h.player1_id = u1.id
     LEFT JOIN users u2 ON h.player2_id = u2.id
     LEFT JOIN users u3 ON h.player3_id = u3.id
     WHERE h.player1_id = ? OR h.player2_id = ? OR h.player3_id = ?
     ORDER BY h.ended_at DESC
     LIMIT ?`,
    [userId, userId, userId, limit || 20]
  );
}

function getTotalCount() {
  const row = get('SELECT COUNT(*) as count FROM game_history');
  return row ? row.count : 0;
}

module.exports = {
  saveGameHistory,
  getHistoryList,
  getUserHistory,
  getTotalCount,
};
