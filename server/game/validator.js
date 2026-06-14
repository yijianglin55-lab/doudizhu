/**
 * 出牌合法性验证模块
 * 判断出牌是否符合规则，是否能压过上家
 */

const { CARD_TYPE, identifyType } = require('./cardType');

/**
 * 验证出牌是否合法
 * @param {Array} playCards - 要出的牌
 * @param {Array} lastCards - 上家出的牌（null表示自由出牌）
 * @param {Array} handCards - 当前手牌
 * @returns {object} { valid: boolean, type: string, msg: string }
 */
function validatePlay(playCards, lastCards, handCards) {
  // 1. 检查出的牌是否都在手牌中
  if (!checkInHand(playCards, handCards)) {
    return { valid: false, type: CARD_TYPE.INVALID, msg: '出的牌不在手牌中' };
  }

  // 2. 识别出的牌型
  const typeInfo = identifyType(playCards);
  if (typeInfo.type === CARD_TYPE.INVALID) {
    return { valid: false, type: CARD_TYPE.INVALID, msg: '无效的牌型' };
  }

  // 3. 自由出牌（没有上家或上家是自己）
  if (!lastCards || lastCards.length === 0) {
    return { valid: true, type: typeInfo.type, msg: '合法出牌', typeInfo };
  }

  // 4. 识别上家牌型
  const lastTypeInfo = identifyType(lastCards);
  if (lastTypeInfo.type === CARD_TYPE.INVALID) {
    return { valid: false, type: CARD_TYPE.INVALID, msg: '上家牌型无效' };
  }

  // 5. 王炸最大，可以压任何牌
  if (typeInfo.type === CARD_TYPE.ROCKET) {
    return { valid: true, type: CARD_TYPE.ROCKET, msg: '王炸', typeInfo };
  }

  // 6. 炸弹可以压非炸弹、非王炸的牌
  if (typeInfo.type === CARD_TYPE.BOMB) {
    if (lastTypeInfo.type === CARD_TYPE.ROCKET) {
      return { valid: false, type: CARD_TYPE.BOMB, msg: '炸弹无法压王炸' };
    }
    if (lastTypeInfo.type === CARD_TYPE.BOMB) {
      // 炸弹比炸弹，比牌值大小
      if (typeInfo.mainValue > lastTypeInfo.mainValue) {
        return { valid: true, type: CARD_TYPE.BOMB, msg: '更大的炸弹', typeInfo };
      } else {
        return { valid: false, type: CARD_TYPE.BOMB, msg: '炸弹需要更大' };
      }
    }
    // 炸弹压普通牌
    return { valid: true, type: CARD_TYPE.BOMB, msg: '炸弹', typeInfo };
  }

  // 7. 上家是炸弹或王炸，普通牌无法压
  if (lastTypeInfo.type === CARD_TYPE.BOMB || lastTypeInfo.type === CARD_TYPE.ROCKET) {
    return { valid: false, type: typeInfo.type, msg: '需要炸弹或王炸才能压' };
  }

  // 8. 同类型比较
  if (typeInfo.type !== lastTypeInfo.type) {
    return { valid: false, type: typeInfo.type, msg: '牌型不同，无法压牌' };
  }

  // 9. 同类型需要长度相同
  if (typeInfo.length !== lastTypeInfo.length) {
    return { valid: false, type: typeInfo.type, msg: '牌数不同，无法压牌' };
  }

  // 10. 比较主牌值
  if (typeInfo.mainValue > lastTypeInfo.mainValue) {
    return { valid: true, type: typeInfo.type, msg: '合法出牌', typeInfo };
  } else {
    return { valid: false, type: typeInfo.type, msg: '牌不够大' };
  }
}

/**
 * 检查出的牌是否都在手牌中
 * @param {Array} playCards
 * @param {Array} handCards
 * @returns {boolean}
 */
function checkInHand(playCards, handCards) {
  const handCopy = handCards.map(c => c.id);
  for (const card of playCards) {
    const index = handCopy.indexOf(card.id);
    if (index === -1) {
      return false;
    }
    handCopy.splice(index, 1);
  }
  return true;
}

/**
 * 智能提示：从手牌中找出能压过上家的最小牌组
 * @param {Array} handCards - 当前手牌
 * @param {Array} lastCards - 上家出的牌
 * @returns {Array|null} 推荐出的牌，null表示无法压
 */
function getHint(handCards, lastCards) {
  if (!lastCards || lastCards.length === 0) {
    // 自由出牌，出最小的单张
    return handCards.length > 0 ? [handCards[0]] : null;
  }

  const lastTypeInfo = identifyType(lastCards);
  if (lastTypeInfo.type === CARD_TYPE.INVALID) return null;

  const sortedHand = [...handCards].sort((a, b) => a.value - b.value);

  switch (lastTypeInfo.type) {
    case CARD_TYPE.SINGLE:
      return findSingle(sortedHand, lastTypeInfo.mainValue);
    case CARD_TYPE.PAIR:
      return findPair(sortedHand, lastTypeInfo.mainValue);
    case CARD_TYPE.TRIPLE:
      return findTriple(sortedHand, lastTypeInfo.mainValue);
    case CARD_TYPE.TRIPLE_ONE:
      return findTripleOne(sortedHand, lastTypeInfo.mainValue);
    case CARD_TYPE.TRIPLE_TWO:
      return findTripleTwo(sortedHand, lastTypeInfo.mainValue);
    case CARD_TYPE.STRAIGHT:
      return findStraight(sortedHand, lastTypeInfo.mainValue, lastTypeInfo.length);
    case CARD_TYPE.STRAIGHT_PAIR:
      return findStraightPair(sortedHand, lastTypeInfo.mainValue, lastTypeInfo.length);
    case CARD_TYPE.BOMB:
      return findBomb(sortedHand, lastTypeInfo.mainValue);
    default:
      // 对于飞机等复杂牌型，暂时不提供提示
      return null;
  }
}

/**
 * 找能压过的单张
 */
function findSingle(hand, minValue) {
  for (const card of hand) {
    if (card.value > minValue) {
      return [card];
    }
  }
  // 尝试出炸弹
  return findBomb(hand, -1);
}

/**
 * 找能压过的对子
 */
function findPair(hand, minValue) {
  for (let i = 0; i < hand.length - 1; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value > minValue) {
      return [hand[i], hand[i + 1]];
    }
  }
  return findBomb(hand, -1);
}

/**
 * 找能压过的三张
 */
function findTriple(hand, minValue) {
  for (let i = 0; i < hand.length - 2; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value === hand[i + 2].value && hand[i].value > minValue) {
      return [hand[i], hand[i + 1], hand[i + 2]];
    }
  }
  return findBomb(hand, -1);
}

/**
 * 找能压过的三带一
 */
function findTripleOne(hand, minValue) {
  const triple = findTriple(hand, minValue);
  if (!triple) return findBomb(hand, -1);

  const tripleValue = triple[0].value;
  for (const card of hand) {
    if (card.value !== tripleValue) {
      return [...triple, card];
    }
  }
  return null;
}

/**
 * 找能压过的三带二
 */
function findTripleTwo(hand, minValue) {
  const triple = findTriple(hand, minValue);
  if (!triple) return findBomb(hand, -1);

  const tripleValue = triple[0].value;
  for (let i = 0; i < hand.length - 1; i++) {
    if (hand[i].value !== tripleValue && hand[i].value === hand[i + 1].value) {
      return [...triple, hand[i], hand[i + 1]];
    }
  }
  return null;
}

/**
 * 找能压过的顺子
 */
function findStraight(hand, minValue, length) {
  const count = length;
  const distinctValues = [];
  let lastVal = -1;
  for (const card of hand) {
    if (card.value !== lastVal && card.value >= 3 && card.value <= 14) {
      distinctValues.push({ value: card.value, card });
      lastVal = card.value;
    }
  }

  for (let i = 0; i <= distinctValues.length - count; i++) {
    if (distinctValues[i].value > minValue &&
        distinctValues[i + count - 1].value - distinctValues[i].value === count - 1) {
      const result = [];
      for (let j = i; j < i + count; j++) {
        result.push(distinctValues[j].card);
      }
      return result;
    }
  }
  return findBomb(hand, -1);
}

/**
 * 找能压过的连对
 */
function findStraightPair(hand, minValue, length) {
  const pairCount = length / 2;
  const pairs = [];
  for (let i = 0; i < hand.length - 1; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value >= 3 && hand[i].value <= 14) {
      pairs.push({ value: hand[i].value, cards: [hand[i], hand[i + 1]] });
      i++; // 跳过下一张
    }
  }

  for (let i = 0; i <= pairs.length - pairCount; i++) {
    if (pairs[i].value > minValue &&
        pairs[i + pairCount - 1].value - pairs[i].value === pairCount - 1) {
      const result = [];
      for (let j = i; j < i + pairCount; j++) {
        result.push(...pairs[j].cards);
      }
      return result;
    }
  }
  return findBomb(hand, -1);
}

/**
 * 找炸弹
 */
function findBomb(hand, minValue) {
  for (let i = 0; i < hand.length - 3; i++) {
    if (hand[i].value === hand[i + 1].value &&
        hand[i].value === hand[i + 2].value &&
        hand[i].value === hand[i + 3].value &&
        hand[i].value > minValue) {
      return [hand[i], hand[i + 1], hand[i + 2], hand[i + 3]];
    }
  }
  // 尝试王炸
  const hasSmall = hand.find(c => c.value === 16);
  const hasBig = hand.find(c => c.value === 17);
  if (hasSmall && hasBig) {
    return [hasSmall, hasBig];
  }
  return null;
}

module.exports = {
  validatePlay,
  checkInHand,
  getHint,
};
