/**
 * 项目配置文件
 * 集中管理所有可配置项，方便部署时修改
 */

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000, // Render会自动分配PORT
  },

  // 数据库配置
  database: {
    path: './data/doudizhu.db', // SQLite数据库文件路径
  },

  // JWT / 会话配置
  auth: {
    secret: 'doudizhu-secret-key-2024', // 会话密钥（生产环境请更换）
    tokenExpiry: '24h',                  // Token过期时间
  },

  // 管理员初始账号
  admin: {
    username: 'admin',
    password: 'admin123', // 首次启动后请修改
  },

  // 游戏配置
  game: {
    maxPlayers: 3,             // 每局最大玩家数
    turnTimeout: 30,           // 出牌超时时间（秒）
    baseScore: 100,            // 基础底分
    minGold: 1000,             // 最低入场金币
    robotDelay: 1000,          // 机器人出牌延迟（毫秒）
  },

  // 匹配配置
  match: {
    queueCheckInterval: 2000,  // 匹配队列检查间隔（毫秒）
    maxWaitTime: 60000,        // 最大等待时间（毫秒）
  },

  // 断线重连配置
  reconnect: {
    maxOfflineTime: 300000,    // 最大离线时间（毫秒），超时自动退出
    checkInterval: 10000,      // 离线检查间隔（毫秒）
  },
};
