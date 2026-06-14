# 斗地主 - 网页端联机斗地主游戏

## 项目简介

基于 Node.js + Express + WebSocket + SQLite 开发的网页端联机斗地主游戏，支持手机横屏自适应。

## 技术栈

### 服务端
- **Node.js** + **Express** - HTTP服务器
- **ws** - WebSocket实时通信
- **sqlite3** - 轻量级数据库
- **bcrypt** - 密码加密

### 前端
- **HTML5** + **CSS3** + **JavaScript** (原生)
- **Canvas** - 特效动画
- **CSS3 Transitions** - UI动画过渡

## 项目结构

```
斗地主/
├── server/                    # 服务端
│   ├── app.js                # 入口文件
│   ├── package.json          # 依赖配置
│   ├── config/
│   │   └── index.js          # 项目配置
│   ├── database/
│   │   ├── init.js           # 数据库初始化
│   │   ├── users.js          # 用户数据模块
│   │   ├── rooms.js          # 房间数据模块
│   │   └── history.js        # 对局记录模块
│   ├── middleware/
│   │   └── auth.js           # 认证中间件
│   ├── game/
│   │   ├── deck.js           # 牌组管理
│   │   ├── cardType.js       # 牌型识别
│   │   ├── validator.js      # 出牌验证
│   │   ├── landlord.js       # 游戏逻辑
│   │   └── settlement.js     # 结算模块
│   ├── routes/
│   │   ├── auth.js           # 认证路由
│   │   ├── room.js           # 房间路由
│   │   └── admin.js          # 后台管理路由
│   └── ws/
│       ├── index.js          # WebSocket处理
│       └── match.js          # 匹配队列
│
├── client/                    # 前端页面
│   ├── index.html            # 首页
│   ├── login.html            # 登录页
│   ├── register.html         # 注册页
│   ├── lobby.html            # 大厅页
│   ├── room.html             # 房间等待页
│   ├── game.html             # 游戏对局页
│   ├── profile.html          # 个人信息页
│   ├── admin.html            # 后台管理页
│   ├── css/
│   │   ├── common.css        # 公共样式
│   │   ├── cards.css         # 扑克牌样式
│   │   ├── game.css          # 游戏桌面样式
│   │   ├── animations.css    # 动画样式
│   │   └── responsive.css    # 响应式样式
│   ├── js/
│   │   ├── utils.js          # 工具函数
│   │   ├── api.js            # HTTP接口
│   │   ├── ws.js             # WebSocket客户端
│   │   ├── cards.js          # 扑克牌渲染
│   │   └── game.js           # 游戏逻辑
│   └── canvas/
│       └── effects.js        # Canvas特效
│
└── README.md                  # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 启动服务器

```bash
cd server
npm start
```

### 3. 访问游戏

- **游戏地址**: http://localhost:3000
- **后台管理**: http://localhost:3000/admin.html

### 4. 管理员账号

- **账号**: admin
- **密码**: admin123

> ⚠️ 首次启动后请修改管理员密码

## 游戏功能

### 联机模式
1. **快速匹配** - 自动匹配3名玩家开始游戏
2. **创建房间** - 创建私密房间，分享房间号给好友

### 斗地主规则
- 完整的牌型支持：单张、对子、三带、顺子、连对、飞机、炸弹、王炸
- 叫分抢地主机制
- 倍数计算（炸弹、春天翻倍）
- 金币结算系统

### 特色功能
- 手机横屏自适应
- Canvas特效动画（炸弹、王炸特效）
- 断线重连
- 后台管理系统

## WebSocket通信协议

### 客户端发送格式
```json
{
  "type": "消息类型",
  "data": { ... }
}
```

### 服务端推送格式
```json
{
  "event": "事件名称",
  "data": { ... }
}
```

## API接口

### 认证接口
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/profile` - 获取个人信息

### 房间接口
- `GET /api/rooms/list` - 获取房间列表

### 管理员接口
- `GET /api/admin/users` - 获取用户列表
- `PUT /api/admin/users/:id/gold` - 修改金币
- `PUT /api/admin/users/:id/ban` - 封禁/解封
- `GET /api/admin/stats` - 系统统计
