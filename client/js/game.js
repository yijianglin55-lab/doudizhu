/**
 * 游戏主逻辑模块
 * 处理游戏状态、界面更新、用户交互
 */

const Game = {
  // 游戏状态
  state: {
    myIndex: -1,           // 我的座位索引
    myCards: [],           // 我的手牌
    players: [],           // 玩家列表
    landlordIndex: -1,     // 地主索引
    landlordCards: [],     // 底牌
    currentPlayer: -1,     // 当前出牌玩家
    lastPlayCards: null,   // 上次出的牌
    lastPlayPlayer: -1,    // 上次出牌的玩家
    multiplier: 1,         // 倍数
    baseScore: 100,        // 底分
    isPlaying: false,      // 是否在游戏中
    isMyTurn: false,       // 是否轮到我
    roomId: null,          // 房间ID
    roomCode: null,        // 房间号
  },

  // DOM元素缓存
  elements: {},

  /**
   * 初始化游戏
   */
  init() {
    this.cacheElements();
    this.bindEvents();
    this.bindWS();
    Effects.init('effects-canvas');
    Utils.checkOrientation();
  },

  /**
   * 缓存DOM元素
   */
  cacheElements() {
    this.elements = {
      handArea: document.getElementById('hand-area'),
      playArea: document.getElementById('play-area'),
      landlordCardsArea: document.getElementById('landlord-cards'),
      actionBar: document.getElementById('action-bar'),
      bidPanel: document.getElementById('bid-panel'),
      playerInfos: [
        document.getElementById('player-0'),
        document.getElementById('player-1'),
        document.getElementById('player-2'),
      ],
      opponentHands: [
        null, // 自己
        document.getElementById('opponent-hand-1'),
        document.getElementById('opponent-hand-2'),
      ],
      playedCards: [
        document.getElementById('played-cards-0'),
        document.getElementById('played-cards-1'),
        document.getElementById('played-cards-2'),
      ],
      multiplierDisplay: document.getElementById('multiplier-display'),
      chatMessages: document.getElementById('chat-messages'),
      chatInput: document.getElementById('chat-input'),
    };
  },

  /**
   * 绑定UI事件
   */
  bindEvents() {
    // 出牌按钮
    document.getElementById('btn-play')?.addEventListener('click', () => this.onPlay());
    // 不出按钮
    document.getElementById('btn-pass')?.addEventListener('click', () => this.onPass());
    // 提示按钮
    document.getElementById('btn-hint')?.addEventListener('click', () => this.onHint());
    // 叫分按钮
    document.querySelectorAll('.bid-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const score = parseInt(btn.dataset.score);
        this.onBid(score);
      });
    });
    // 聊天
    document.getElementById('btn-chat')?.addEventListener('click', () => this.onChat());
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.onChat();
    });
    // 准备按钮
    document.getElementById('btn-ready')?.addEventListener('click', () => this.onReady());
    // 开始游戏
    document.getElementById('btn-start')?.addEventListener('click', () => this.onStartGame());
    // 离开房间
    document.getElementById('btn-leave')?.addEventListener('click', () => this.onLeaveRoom());
    // 解散房间
    document.getElementById('btn-dissolve')?.addEventListener('click', () => this.onDissolve());
  },

  /**
   * 绑定WebSocket事件
   */
  bindWS() {
    // 认证结果
    WS.on('auth_result', (data) => {
      if (data.success) {
        console.log('认证成功');
        if (data.gameState) {
          this.restoreGameState(data.gameState);
        }
      }
    });

    // 匹配成功
    WS.on('match_success', (data) => {
      this.state.roomId = data.roomId;
      this.state.roomCode = data.roomCode;
      this.updateGameState(data.gameState);
      this.showPage('room');
      Utils.toast('匹配成功！', 'success');
    });

    // 房间创建
    WS.on('room_created', (data) => {
      this.state.roomId = data.roomId;
      this.state.roomCode = data.roomCode;
      this.updateGameState(data.gameState);
      this.showPage('room');
    });

    // 加入房间
    WS.on('room_joined', (data) => {
      this.state.roomId = data.roomId;
      this.state.roomCode = data.roomCode;
      this.updateGameState(data.gameState);
      this.showPage('room');
    });

    // 玩家加入
    WS.on('player_joined', (data) => {
      this.updateGameState(data.gameState);
      Utils.toast(`${data.nickname || '玩家'}加入了房间`, 'info');
    });

    // 玩家离开
    WS.on('player_left', (data) => {
      this.updateGameState(data.gameState);
      Utils.toast('有玩家离开了房间', 'info');
    });

    // 玩家准备
    WS.on('player_ready', (data) => {
      this.updateGameState(data.gameState);
    });

    // 游戏开始
    WS.on('game_started', (data) => {
      this.state.myCards = data.hands;
      this.state.isPlaying = true;
      this.updateGameState(data.gameState);
      this.renderMyHand();
      this.showPage('game');
    });

    // 叫分开始
    WS.on('bidding_start', (data) => {
      this.showBidPanel(data.firstBidder);
    });

    // 叫分结果
    WS.on('bid_result', (data) => {
      if (data.action === 'landlord_settled') {
        this.state.landlordIndex = data.landlordIndex;
        this.state.multiplier = data.multiplier;
        this.hideBidPanel();
        Cards.renderLandlordCards(data.landlordCards, this.elements.landlordCardsArea, true);
      } else if (data.action === 'next_bid') {
        this.showBidPanel(data.nextBidder);
      }
      this.addChatMessage('系统', `玩家叫了 ${data.score} 分`);
    });

    // 出牌开始
    WS.on('play_start', (data) => {
      this.state.landlordIndex = data.landlordIndex;
      this.state.multiplier = data.multiplier;
      this.state.currentPlayer = data.firstPlayer;
      this.state.landlordCards = data.landlordCards;
      this.updatePlayerStatus();
      this.updateMultiplier();
    });

    // 出牌
    WS.on('card_played', (data) => {
      this.onCardPlayed(data);
    });

    // 不出
    WS.on('player_pass', (data) => {
      this.onPlayerPass(data);
    });

    // 提示结果
    WS.on('hint_result', (data) => {
      if (data.cards && data.cards.length > 0) {
        const cardIds = data.cards.map(c => c.id);
        Cards.highlightCards(cardIds, this.elements.handArea);
      } else {
        Utils.toast('没有能压过的牌', 'warning');
      }
    });

    // 聊天消息
    WS.on('chat_message', (data) => {
      this.addChatMessage(data.nickname, data.message);
    });

    // 游戏结束
    WS.on('game_over', (data) => {
      this.onGameOver(data);
    });

    // 房间解散
    WS.on('room_dissolved', () => {
      Utils.toast('房间已解散', 'info');
      this.resetState();
      this.showPage('lobby');
    });

    // 被踢出
    WS.on('kicked', (data) => {
      Utils.toast(data.msg, 'warning');
      this.resetState();
      this.showPage('lobby');
    });

    // 离开房间
    WS.on('room_left', () => {
      this.resetState();
      this.showPage('lobby');
    });

    // 玩家断线
    WS.on('player_disconnected', (data) => {
      Utils.toast('有玩家断线了', 'warning');
    });

    // 在线人数
    WS.on('online_count', (data) => {
      const el = document.getElementById('online-count');
      if (el) el.textContent = data.count;
    });

    // 错误消息
    WS.on('error', (data) => {
      Utils.toast(data.msg, 'error');
    });
  },

  /**
   * 更新游戏状态
   * @param {object} gameState
   */
  updateGameState(gameState) {
    if (!gameState) return;

    this.state.myIndex = gameState.myIndex;
    this.state.players = gameState.players;
    this.state.landlordIndex = gameState.landlordIndex;
    this.state.currentPlayer = gameState.currentPlayerIndex;
    this.state.lastPlayCards = gameState.lastPlayCards;
    this.state.lastPlayPlayer = gameState.lastPlayPlayerIndex;
    this.state.multiplier = gameState.multiplier;
    this.state.baseScore = gameState.baseScore;
    this.state.myCards = gameState.myCards || this.state.myCards;

    this.updatePlayersInfo();
    this.updatePlayerStatus();
    this.updateMultiplier();
  },

  /**
   * 恢复游戏状态（断线重连）
   * @param {object} gameState
   */
  restoreGameState(gameState) {
    this.updateGameState(gameState);
    if (gameState.state === 'playing' || gameState.state === 'bidding') {
      this.state.isPlaying = true;
      this.showPage('game');
      this.renderMyHand();
    } else if (gameState.state === 'waiting') {
      this.showPage('room');
    }
  },

  /**
   * 渲染我的手牌
   */
  renderMyHand() {
    Cards.renderHand(this.state.myCards, this.elements.handArea, true);
  },

  /**
   * 更新玩家信息显示
   */
  updatePlayersInfo() {
    for (let i = 0; i < 3; i++) {
      const player = this.state.players[i];
      const infoEl = this.elements.playerInfos[i];
      if (!infoEl || !player) continue;

      infoEl.querySelector('.player-name').textContent = player.nickname;
      infoEl.querySelector('.player-cards-count').textContent = `${player.handCount}张`;

      if (player.isLandlord) {
        infoEl.classList.add('landlord');
      } else {
        infoEl.classList.remove('landlord');
      }

      // 更新对手手牌
      if (i !== this.state.myIndex) {
        const relativeIndex = this.getRelativeIndex(i);
        const handEl = this.elements.opponentHands[relativeIndex];
        if (handEl) {
          Cards.renderOpponentHand(player.handCount, handEl);
        }
      }
    }
  },

  /**
   * 更新当前出牌玩家状态
   */
  updatePlayerStatus() {
    for (let i = 0; i < 3; i++) {
      const infoEl = this.elements.playerInfos[i];
      if (!infoEl) continue;

      if (i === this.state.currentPlayer) {
        infoEl.classList.add('active');
      } else {
        infoEl.classList.remove('active');
      }
    }

    this.state.isMyTurn = this.state.currentPlayer === this.state.myIndex;

    // 显示/隐藏操作按钮
    if (this.state.isMyTurn && this.state.isPlaying) {
      this.elements.actionBar?.classList.remove('hidden');
    } else {
      this.elements.actionBar?.classList.add('hidden');
    }
  },

  /**
   * 更新倍数显示
   */
  updateMultiplier() {
    const el = this.elements.multiplierDisplay;
    if (el) {
      el.textContent = `×${this.state.multiplier}`;
    }
  },

  /**
   * 显示叫分面板
   * @param {number} bidderIndex
   */
  showBidPanel(bidderIndex) {
    const panel = this.elements.bidPanel;
    if (!panel) return;

    if (bidderIndex === this.state.myIndex) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  },

  /**
   * 隐藏叫分面板
   */
  hideBidPanel() {
    this.elements.bidPanel?.classList.add('hidden');
  },

  /**
   * 出牌处理
   */
  onPlay() {
    const cardIds = Cards.getSelectedCardIds(this.elements.handArea);
    if (cardIds.length === 0) {
      Utils.toast('请先选择要出的牌', 'warning');
      return;
    }

    WS.playCards(cardIds);
  },

  /**
   * 不出处理
   */
  onPass() {
    WS.pass();
  },

  /**
   * 提示处理
   */
  onHint() {
    WS.hint();
  },

  /**
   * 叫分处理
   * @param {number} score
   */
  onBid(score) {
    WS.bid(score);
  },

  /**
   * 准备处理
   */
  onReady() {
    WS.ready();
  },

  /**
   * 开始游戏
   */
  onStartGame() {
    WS.startGame();
  },

  /**
   * 离开房间
   */
  onLeaveRoom() {
    if (this.state.isPlaying) {
      Utils.toast('游戏进行中，无法离开', 'warning');
      return;
    }
    WS.leaveRoom();
  },

  /**
   * 解散房间
   */
  onDissolve() {
    WS.dissolveRoom();
  },

  /**
   * 聊天处理
   */
  onChat() {
    const input = this.elements.chatInput;
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    WS.chat(message);
    input.value = '';
  },

  /**
   * 出牌事件处理
   * @param {object} data
   */
  onCardPlayed(data) {
    const { playerIndex, cards, cardType, typeName, nextPlayer, remainingCards, multiplier } = data;

    // 显示出的牌
    const playedEl = this.elements.playedCards[this.getRelativeIndex(playerIndex)];
    if (playedEl) {
      Cards.renderPlayedCards(cards, playedEl);
    }

    // 显示牌型标签
    if (typeName && cards.length > 0) {
      const rect = playedEl?.getBoundingClientRect();
      if (rect) {
        Effects.showCardType(typeName, rect.left + rect.width / 2, rect.top - 20);
      }
    }

    // 更新手牌
    if (playerIndex === this.state.myIndex) {
      const cardIds = cards.map(c => c.id);
      this.state.myCards = this.state.myCards.filter(c => !cardIds.includes(c.id));
      this.renderMyHand();
    }

    // 更新倍数
    this.state.multiplier = multiplier;
    this.updateMultiplier();

    // 炸弹特效
    if (cardType === 'bomb') {
      Effects.bombEffect(window.innerWidth / 2, window.innerHeight / 2);
      Effects.floatingText('炸弹！×2', window.innerWidth / 2, window.innerHeight / 2 - 80);
    } else if (cardType === 'rocket') {
      Effects.rocketEffect(window.innerWidth / 2, window.innerHeight / 2);
    }

    // 更新当前玩家
    this.state.currentPlayer = nextPlayer;
    this.updatePlayerStatus();

    // 清除其他玩家的出牌显示（延迟）
    setTimeout(() => {
      for (let i = 0; i < 3; i++) {
        if (i !== this.getRelativeIndex(playerIndex)) {
          const el = this.elements.playedCards[i];
          if (el) el.innerHTML = '';
        }
      }
    }, 1500);
  },

  /**
   * 不出事件处理
   * @param {object} data
   */
  onPlayerPass(data) {
    const { playerIndex, nextPlayer } = data;

    const playedEl = this.elements.playedCards[this.getRelativeIndex(playerIndex)];
    if (playedEl) {
      playedEl.innerHTML = '<div class="pass-label">不出</div>';
    }

    this.state.currentPlayer = nextPlayer;
    this.updatePlayerStatus();
  },

  /**
   * 游戏结束处理
   * @param {object} data
   */
  onGameOver(data) {
    const { winnerIndex, landlordWin, isSpring, multiplier, scores, settlement } = data;
    this.state.isPlaying = false;

    // 结算动画
    const isWin = (scores[this.state.myIndex] > 0);

    // 显示结算弹窗
    setTimeout(() => {
      this.showResultModal({
        isWin,
        landlordWin,
        isSpring,
        multiplier,
        scores,
        settlement,
      });
    }, 1000);

    // 胜利金币效果
    if (isWin) {
      Effects.coinDrop(window.innerWidth / 2, window.innerHeight / 3, 15);
    }
  },

  /**
   * 显示结算弹窗
   * @param {object} result
   */
  showResultModal(result) {
    const modal = document.getElementById('result-modal');
    if (!modal) return;

    const titleEl = modal.querySelector('.result-title');
    if (titleEl) {
      titleEl.textContent = result.isWin ? '胜利！' : '失败';
      titleEl.className = `result-title ${result.isWin ? 'win' : 'lose'}`;
    }

    const detailEl = modal.querySelector('.result-detail');
    if (detailEl) {
      let detail = `底分: ${this.state.baseScore} × ${result.multiplier}`;
      if (result.isSpring) detail += ' (春天×2)';
      detailEl.textContent = detail;
    }

    const scoresEl = modal.querySelector('.result-scores');
    if (scoresEl && result.settlement) {
      scoresEl.innerHTML = result.settlement.players.map(p => `
        <div class="result-player">
          <div class="result-player-name">${p.nickname}</div>
          <div class="result-player-score ${p.score > 0 ? 'positive' : 'negative'}">
            ${p.score > 0 ? '+' : ''}${p.score}
          </div>
        </div>
      `).join('');
    }

    modal.classList.add('active');
  },

  /**
   * 关闭结算弹窗
   */
  closeResultModal() {
    document.getElementById('result-modal')?.classList.remove('active');
  },

  /**
   * 添加聊天消息
   * @param {string} name
   * @param {string} message
   */
  addChatMessage(name, message) {
    const container = this.elements.chatMessages;
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'chat-message chat-bubble';
    div.innerHTML = `<strong>${name}:</strong> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  },

  /**
   * 获取相对座位索引（将绝对索引转换为相对于自己的位置）
   * @param {number} absoluteIndex
   * @returns {number} 0=自己, 1=下家, 2=上家
   */
  getRelativeIndex(absoluteIndex) {
    return (absoluteIndex - this.state.myIndex + 3) % 3;
  },

  /**
   * 重置游戏状态
   */
  resetState() {
    this.state = {
      myIndex: -1,
      myCards: [],
      players: [],
      landlordIndex: -1,
      landlordCards: [],
      currentPlayer: -1,
      lastPlayCards: null,
      lastPlayPlayer: -1,
      multiplier: 1,
      baseScore: 100,
      isPlaying: false,
      isMyTurn: false,
      roomId: null,
      roomCode: null,
    };

    // 清除所有出牌显示
    this.elements.playedCards?.forEach(el => {
      if (el) el.innerHTML = '';
    });
    this.elements.handArea && (this.elements.handArea.innerHTML = '');
    this.elements.landlordCardsArea && (this.elements.landlordCardsArea.innerHTML = '');
  },

  /**
   * 显示页面
   * @param {string} pageName
   */
  showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });
    document.getElementById(`page-${pageName}`)?.classList.add('active');
  },
};
