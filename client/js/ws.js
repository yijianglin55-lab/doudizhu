/**
 * WebSocket客户端模块
 */

const WS = {
  socket: null,
  isConnected: false,
  isAuthenticated: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,
  handlers: {},
  reconnectTimer: null,
  intentionalClose: false, // 标记：是否主动关闭

  connect() {
    var self = this;
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = protocol + '//' + location.host;

    // 清理旧连接
    if (this.socket) {
      this.intentionalClose = true;
      try { this.socket.close(); } catch(e) {}
      this.socket = null;
    }
    this.intentionalClose = false;

    console.log('[WS] 连接:', wsUrl);
    try {
      this.socket = new WebSocket(wsUrl);
    } catch (err) {
      console.error('[WS] 创建失败:', err);
      return;
    }

    this.socket.onopen = function() {
      console.log('[WS] 已连接');
      self.isConnected = true;
      self.reconnectAttempts = 0;
      self.intentionalClose = false;
      self.emit('connected');

      var token = Utils.storage.get('token');
      if (token) {
        console.log('[WS] 发送认证...');
        self.send('auth', { token: token });
      }
    };

    this.socket.onmessage = function(event) {
      try {
        var msg = JSON.parse(event.data);
        if (msg.event === 'auth_result') {
          self.isAuthenticated = msg.data && msg.data.success;
          console.log('[WS] 认证结果:', self.isAuthenticated);
        }
        self.emit(msg.event, msg.data);
      } catch (err) {
        console.error('[WS] 解析消息失败:', err);
      }
    };

    this.socket.onclose = function(event) {
      console.log('[WS] 连接关闭:', event.code, 'intentional:', self.intentionalClose);
      self.isConnected = false;
      self.isAuthenticated = false;
      self.emit('disconnected');

      // 如果是主动关闭（被新连接替代），不重连
      if (self.intentionalClose) {
        console.log('[WS] 主动关闭，不重连');
        self.intentionalClose = false;
        return;
      }

      // 自动重连
      if (self.reconnectAttempts < self.maxReconnectAttempts) {
        self.reconnectTimer = setTimeout(function() {
          self.reconnectAttempts++;
          console.log('[WS] 重连 (' + self.reconnectAttempts + '/' + self.maxReconnectAttempts + ')');
          self.emit('reconnecting', { attempt: self.reconnectAttempts });
          self.connect();
        }, self.reconnectDelay);
      } else {
        console.error('[WS] 重连失败');
        self.emit('reconnect_failed');
      }
    };

    this.socket.onerror = function(err) {
      console.error('[WS] 错误:', err);
    };
  },

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.intentionalClose = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.isAuthenticated = false;
  },

  send(type, data) {
    if (!data) data = {};
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('[WS] 未连接, readyState:', this.socket ? this.socket.readyState : 'null');
      Utils.toast('服务器未连接，请刷新页面', 'error');
      return false;
    }
    var message = JSON.stringify({ type: type, data: data });
    console.log('[WS] 发送:', type);
    this.socket.send(message);
    return true;
  },

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  },

  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(function(h) { return h !== handler; });
    }
  },

  emit(event, data) {
    var list = this.handlers[event];
    if (list) {
      for (var i = 0; i < list.length; i++) {
        try { list[i](data); } catch (err) { console.error('[WS] 处理器错误 [' + event + ']:', err); }
      }
    }
  },

  // ===== 便捷方法 =====
  joinMatch() { return this.send('join_match'); },
  leaveMatch() { return this.send('leave_match'); },
  createRoom(password, baseScore) { return this.send('create_room', { password: password, baseScore: baseScore }); },
  joinRoom(roomCode, password) { return this.send('join_room', { roomCode: roomCode, password: password }); },
  leaveRoom() { return this.send('leave_room'); },
  ready() { return this.send('ready'); },
  startGame() { return this.send('start_game'); },
  bid(score) { return this.send('bid', { score: score }); },
  playCards(cardIds) { return this.send('play', { cardIds: cardIds }); },
  pass() { return this.send('pass'); },
  hint() { return this.send('hint'); },
  chat(message) { return this.send('chat', { message: message }); },
  kickPlayer(userId) { return this.send('kick_player', { userId: userId }); },
  dissolveRoom() { return this.send('dissolve_room'); },
};
