/**
 * 牌组管理模块
 * 负责洗牌、发牌、牌的表示和转换
 *
 * 牌的数值表示：
 * 3=3, 4=4, ..., 10=10, J=11, Q=12, K=13, A=14, 2=15, 小王=16, 大王=17
 *
 * 花色表示：
 * 0=黑桃♠, 1=红心♥, 2=梅花♣, 3=方块♦
 */

// 牌值常量
const CARD_VALUES = {
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
  NINE: 9,
  TEN: 10,
  JACK: 11,
  QUEEN: 12,
  KING: 13,
  ACE: 14,
  TWO: 15,
  JOKER_SMALL: 16,
  JOKER_BIG: 17,
};

// 花色常量
const SUITS = {
  SPADE: 0,    // 黑桃 ♠
  HEART: 1,    // 红心 ♥
  CLUB: 2,     // 梅花 ♣
  DIAMOND: 3,  // 方块 ♦
};

// 牌值显示名称
const VALUE_NAMES = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2',
  16: '小王', 17: '大王',
};

// 花色显示符号
const SUIT_SYMBOLS = {
  0: '♠', 1: '♥', 2: '♣', 3: '♦',
};

/**
 * 生成一副完整的54张扑克牌
 * @returns {Array} 牌组数组，每张牌包含 {value, suit, id}
 */
function createDeck() {
  const deck = [];
  let id = 0;

  // 生成普通牌（3-A各4花色，2各4花色 = 52张）
  for (let value = 3; value <= 15; value++) {
    for (let suit = 0; suit <= 3; suit++) {
      deck.push({ value, suit, id: id++ });
    }
  }

  // 生成大小王
  deck.push({ value: 16, suit: -1, id: id++ }); // 小王
  deck.push({ value: 17, suit: -1, id: id++ }); // 大王

  return deck;
}

/**
 * 洗牌算法（Fisher-Yates）
 * @param {Array} deck - 牌组
 * @returns {Array} 洗好的牌组
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 发牌
 * 54张牌：每人17张，留3张底牌
 * @returns {object} { players: [17张, 17张, 17张], landlordCards: [3张] }
 */
function dealCards() {
  const deck = shuffleDeck(createDeck());

  const players = [[], [], []];
  const landlordCards = [];

  // 发17张牌给每个玩家
  for (let i = 0; i < 51; i++) {
    players[i % 3].push(deck[i]);
  }

  // 剩余3张为底牌
  for (let i = 51; i < 54; i++) {
    landlordCards.push(deck[i]);
  }

  // 对每个玩家的手牌排序（按值从小到大，同值按花色）
  players.forEach(hand => sortCards(hand));

  return { players, landlordCards };
}

/**
 * 对手牌排序
 * @param {Array} cards
 * @returns {Array} 排序后的牌（不改变原数组）
 */
function sortCards(cards) {
  return cards.sort((a, b) => {
    if (a.value !== b.value) return a.value - b.value;
    return a.suit - b.suit;
  });
}

/**
 * 获取牌的显示名称
 * @param {object} card
 * @returns {string}
 */
function getCardName(card) {
  if (card.value >= 16) {
    return VALUE_NAMES[card.value];
  }
  return SUIT_SYMBOLS[card.suit] + VALUE_NAMES[card.value];
}

/**
 * 获取牌组的显示名称
 * @param {Array} cards
 * @returns {string}
 */
function getCardsName(cards) {
  return cards.map(getCardName).join(' ');
}

/**
 * 牌值转换为前端显示用的对象
 * @param {object} card
 * @returns {object}
 */
function cardToClient(card) {
  return {
    value: card.value,
    suit: card.suit,
    id: card.id,
    name: getCardName(card),
  };
}

/**
 * 批量转换牌组为前端格式
 * @param {Array} cards
 * @returns {Array}
 */
function cardsToClient(cards) {
  return cards.map(cardToClient);
}

module.exports = {
  CARD_VALUES,
  SUITS,
  VALUE_NAMES,
  SUIT_SYMBOLS,
  createDeck,
  shuffleDeck,
  dealCards,
  sortCards,
  getCardName,
  getCardsName,
  cardToClient,
  cardsToClient,
};
