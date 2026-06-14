/**
 * 房间数据模块
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

function generateRoomCode() {
  return Math.random().toString().slice(2, 8);
}

function createRoom(ownerId, password, baseScore) {
  const roomCode = generateRoomCode();
  const db = getDb();
  db.run(
    'INSERT INTO rooms (room_code, owner_id, password, base_score, current_players) VALUES (?, ?, ?, ?, 1)',
    [roomCode, ownerId, password || '', baseScore || 100]
  );
  saveDatabase();
  // 用room_code查询刚插入的记录（避免sql.js的last_insert_rowid问题）
  const row = get('SELECT * FROM rooms WHERE room_code = ?', [roomCode]);
  return row || {
    id: Date.now(),
    room_code: roomCode,
    owner_id: ownerId,
    password: password || '',
    status: 'waiting',
    base_score: baseScore || 100,
    current_players: 1,
  };
}

function findByCode(roomCode) {
  return get('SELECT * FROM rooms WHERE room_code = ?', [roomCode]);
}

function findById(id) {
  return get('SELECT * FROM rooms WHERE id = ?', [id]);
}

function updateStatus(roomId, status) {
  run('UPDATE rooms SET status = ? WHERE id = ?', [status, roomId]);
}

function updatePlayerCount(roomId, count) {
  run('UPDATE rooms SET current_players = ? WHERE id = ?', [count, roomId]);
}

function deleteRoom(roomId) {
  run('DELETE FROM rooms WHERE id = ?', [roomId]);
}

function getActiveRooms() {
  return all("SELECT * FROM rooms WHERE status != 'finished' ORDER BY created_at DESC");
}

function getWaitingRooms() {
  return all("SELECT * FROM rooms WHERE status = 'waiting' AND password = '' ORDER BY created_at DESC");
}

function cleanExpiredRooms() {
  run("DELETE FROM rooms WHERE status = 'waiting' AND created_at < datetime('now', 'localtime', '-2 hours')");
}

module.exports = {
  createRoom,
  findByCode,
  findById,
  updateStatus,
  updatePlayerCount,
  deleteRoom,
  getActiveRooms,
  getWaitingRooms,
  cleanExpiredRooms,
};
