/**
 * 斗地主游戏服务端入口
 * 支持本地多端口和线上单端口部署
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const config = require('./config');
const { initDatabase } = require('./database/init');
const { initWebSocket } = require('./ws/index');

const app = express();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// API 路由（必须在静态文件之前）
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rooms', require('./routes/room'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => {
  res.json({ code: 0, msg: 'ok', data: { uptime: process.uptime(), port: config.server.port } });
});

// 静态文件
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// SPA 兜底：非 API、非静态文件的请求返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, msg: '服务器内部错误', data: null });
});

// 启动
async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');

    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    initWebSocket(wss);

    const port = config.server.port;
    server.listen(port, '0.0.0.0', () => {
      console.log('===========================================');
      console.log('  斗地主游戏服务器已启动');
      console.log(`  端口: ${port}`);
      if (process.env.RENDER) {
        console.log('  运行环境: Render');
      } else {
        console.log(`  游戏地址: http://localhost:${port}`);
        console.log(`  后台管理: http://localhost:${port}/admin.html`);
        console.log(`  管理员: ${config.admin.username} / ${config.admin.password}`);
      }
      console.log('===========================================');
    });
  } catch (err) {
    console.error('服务器启动失败:', err);
    process.exit(1);
  }
}

startServer();

module.exports = { app };
