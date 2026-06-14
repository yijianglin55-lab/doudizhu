const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const config = require('./config');
const { initDatabase } = require('./database/init');
const { initWebSocket } = require('./ws/index');

const app = express();

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

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rooms', require('./routes/room'));
app.use('/api/admin', require('./routes/admin'));
app.get('/api/health', (req, res) => {
  res.json({ code: 0, msg: 'ok', data: { uptime: process.uptime() } });
});

// 静态文件（放在API之后）
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));

// 兜底路由
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 500, msg: '服务器错误' });
});

// 启动
async function start() {
  await initDatabase();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });
  initWebSocket(wss);
  const port = process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`服务器已启动，端口: ${port}`);
  });
}

start();
