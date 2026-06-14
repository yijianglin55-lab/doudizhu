/**
 * 扑克牌渲染模块
 * 负责创建和管理扑克牌的DOM元素
 */

const Cards = {
  // 花色符号
  SUIT_SYMBOLS: {
    0: '♠',  // 黑桃
    1: '♥',  // 红心
    2: '♣',  // 梅花
    3: '♦',  // 方块
    '-1': '🃏', // 王
  },

  // 花色CSS类名
  SUIT_CLASSES: {
    0: 'spade',
    1: 'heart',
    2: 'club',
    3: 'diamond',
    '-1': 'joker',
  },

  // 牌值显示
  VALUE_DISPLAY: {
    3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2',
    16: '小王', 17: '大王',
  },

  /**
   * 创建扑克牌DOM元素
   * @param {object} card - { value, suit, id }
   * @param {string} size - 'normal', 'sm', 'xs'
   * @returns {HTMLElement}
   */
  createCard(card, size = 'normal') {
    const div = document.createElement('div');
    div.dataset.cardId = card.id;
    div.dataset.value = card.value;
    div.dataset.suit = card.suit;

    const sizeClass = size !== 'normal' ? ` card-${size}` : '';

    // 大小王特殊处理
    if (card.value >= 16) {
      div.className = `card ${card.value === 17 ? 'joker-big' : 'joker-small'}${sizeClass}`;
      div.innerHTML = `
        <div class="card-corner card-corner-tl">
          <span class="card-value">${this.VALUE_DISPLAY[card.value]}</span>
        </div>
        <div class="card-suit-center">${card.value === 17 ? '👑' : '🃏'}</div>
        <div class="card-corner card-corner-br">
          <span class="card-value">${this.VALUE_DISPLAY[card.value]}</span>
        </div>
      `;
    } else {
      const suitClass = this.SUIT_CLASSES[card.suit];
      const suitSymbol = this.SUIT_SYMBOLS[card.suit];
      div.className = `card ${suitClass}${sizeClass}`;
      div.innerHTML = `
        <div class="card-corner card-corner-tl">
          <span class="card-value">${this.VALUE_DISPLAY[card.value]}</span>
          <span class="card-suit-small">${suitSymbol}</span>
        </div>
        <div class="card-suit-center">${suitSymbol}</div>
        <div class="card-corner card-corner-br">
          <span class="card-value">${this.VALUE_DISPLAY[card.value]}</span>
          <span class="card-suit-small">${suitSymbol}</span>
        </div>
      `;
    }

    return div;
  },

  /**
   * 创建牌背面DOM
   * @param {string} size - 'normal', 'sm', 'xs'
   * @returns {HTMLElement}
   */
  createCardBack(size = 'normal') {
    const div = document.createElement('div');
    const sizeClass = size !== 'normal' ? ` card-${size}` : '';
    div.className = `card-back${sizeClass}`;
    return div;
  },

  /**
   * 渲染手牌到容器
   * @param {Array} cards - 牌组
   * @param {HTMLElement} container - 容器元素
   * @param {boolean} selectable - 是否可选中
   * @param {string} size - 牌尺寸
   */
  renderHand(cards, container, selectable = true, size = 'normal') {
    container.innerHTML = '';

    cards.forEach((card, index) => {
      const cardEl = this.createCard(card, size);
      cardEl.style.marginLeft = index > 0 ? '-15px' : '0';
      cardEl.style.zIndex = index;

      if (selectable) {
        cardEl.addEventListener('click', () => {
          cardEl.classList.toggle('selected');
        });
      }

      // 发牌动画延迟
      cardEl.style.animationDelay = `${index * 0.05}s`;
      cardEl.classList.add('card-deal-anim');

      container.appendChild(cardEl);
    });
  },

  /**
   * 渲染出的牌
   * @param {Array} cards
   * @param {HTMLElement} container
   * @param {string} size
   */
  renderPlayedCards(cards, container, size = 'sm') {
    container.innerHTML = '';

    if (!cards || cards.length === 0) return;

    cards.forEach(card => {
      const cardEl = this.createCard(card, size);
      cardEl.style.cursor = 'default';
      container.appendChild(cardEl);
    });
  },

  /**
   * 渲染底牌
   * @param {Array} cards
   * @param {HTMLElement} container
   * @param {boolean} faceUp - 是否正面显示
   */
  renderLandlordCards(cards, container, faceUp = true) {
    container.innerHTML = '';

    cards.forEach((card, index) => {
      const cardEl = faceUp ? this.createCard(card, 'sm') : this.createCardBack('sm');
      cardEl.classList.add('landlord-card-fly');
      cardEl.style.animationDelay = `${index * 0.2}s`;
      container.appendChild(cardEl);
    });
  },

  /**
   * 渲染对手手牌（扇形排列 + 数量标签）
   * @param {number} count - 手牌数量
   * @param {HTMLElement} container
   */
  renderOpponentHand(count, container) {
    container.innerHTML = '';
    if (count <= 0) return;

    // 扇形牌背（最多显示5张）
    var fan = document.createElement('div');
    fan.className = 'opponent-hand-fan';
    var show = Math.min(count, 5);
    for (var i = 0; i < show; i++) {
      var card = document.createElement('div');
      card.className = 'card-back-mini';
      fan.appendChild(card);
    }
    container.appendChild(fan);

    // 数量标签
    var badge = document.createElement('div');
    badge.className = 'hand-count-badge';
    badge.textContent = count + '张';
    container.appendChild(badge);
  },

  /**
   * 获取所有选中的牌ID
   * @param {HTMLElement} container - 手牌容器
   * @returns {Array} 选中的牌ID数组
   */
  getSelectedCardIds(container) {
    const selected = container.querySelectorAll('.card.selected');
    return Array.from(selected).map(el => parseInt(el.dataset.cardId));
  },

  /**
   * 清除所有选中状态
   * @param {HTMLElement} container
   */
  clearSelection(container) {
    container.querySelectorAll('.card.selected').forEach(el => {
      el.classList.remove('selected');
    });
  },

  /**
   * 高亮指定的牌（用于提示）
   * @param {Array} cardIds
   * @param {HTMLElement} container
   */
  highlightCards(cardIds, container) {
    this.clearSelection(container);
    cardIds.forEach(id => {
      const cardEl = container.querySelector(`[data-card-id="${id}"]`);
      if (cardEl) {
        cardEl.classList.add('selected');
      }
    });
  },

  /**
   * 移除出过的牌
   * @param {Array} cardIds
   * @param {HTMLElement} container
   */
  removeCards(cardIds, container) {
    cardIds.forEach(id => {
      const cardEl = container.querySelector(`[data-card-id="${id}"]`);
      if (cardEl) {
        cardEl.classList.add('card-fly-out');
        setTimeout(() => cardEl.remove(), 500);
      }
    });
  },
};
