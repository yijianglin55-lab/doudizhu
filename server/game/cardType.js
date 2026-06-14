/**
 * 牌型识别模块
 * 识别和定义所有斗地主牌型
 *
 * 牌型枚举：
 * SINGLE      - 单张
 * PAIR        - 对子
 * TRIPLE      - 三张
 * TRIPLE_ONE  - 三带一
 * TRIPLE_TWO  - 三带二
 * STRAIGHT    - 顺子（>=5张连续单牌）
 * STRAIGHT_PAIR - 连对（>=3对连续对子）
 * PLANE       - 飞机（>=2个连续三张）
 * PLANE_ONE   - 飞机带单
 * PLANE_TWO   - 飞机带对
 * FOUR_TWO    - 四带二（两张单牌或两对）
 * BOMB        - 炸弹（四张相同）
 * ROCKET      - 王炸（大小王）
 */

// 牌型枚举
const CARD_TYPE = {
  INVALID: 'invalid',         // 无效牌型
  SINGLE: 'single',           // 单张
  PAIR: 'pair',               // 对子
  TRIPLE: 'triple',           // 三张
  TRIPLE_ONE: 'triple_one',   // 三带一
  TRIPLE_TWO: 'triple_two',   // 三带二
  STRAIGHT: 'straight',       // 顺子
  STRAIGHT_PAIR: 'straight_pair', // 连对
  PLANE: 'plane',             // 飞机
  PLANE_ONE: 'plane_one',     // 飞机带单
  PLANE_TWO: 'plane_two',     // 飞机带对
  FOUR_TWO: 'four_two',       // 四带二
  BOMB: 'bomb',               // 炸弹
  ROCKET: 'rocket',           // 王炸
};

// 牌型显示名称
const TYPE_NAMES = {
  single: '单张',
  pair: '对子',
  triple: '三张',
  triple_one: '三带一',
  triple_two: '三带二',
  straight: '顺子',
  straight_pair: '连对',
  plane: '飞机',
  plane_one: '飞机带单',
  plane_two: '飞机带对',
  four_two: '四带二',
  bomb: '炸弹',
  rocket: '王炸',
};

/**
 * 统计牌值出现次数
 * @param {Array} cards - 牌组
 * @returns {Map} key=牌值, value=出现次数
 */
function countValues(cards) {
  const counts = new Map();
  cards.forEach(card => {
    counts.set(card.value, (counts.get(card.value) || 0) + 1);
  });
  return counts;
}

/**
 * 识别牌型
 * @param {Array} cards - 要出的牌组
 * @returns {object} { type: 牌型, mainValue: 主牌值, length: 长度 }
 */
function identifyType(cards) {
  const len = cards.length;
  if (len === 0) return { type: CARD_TYPE.INVALID };

  const counts = countValues(cards);
  const values = Array.from(counts.keys()).sort((a, b) => a - b);
  const countValues2 = Array.from(counts.values());

  // 王炸：大小王
  if (len === 2 && counts.has(16) && counts.has(17)) {
    return { type: CARD_TYPE.ROCKET, mainValue: 17, length: 2 };
  }

  // 单张
  if (len === 1) {
    return { type: CARD_TYPE.SINGLE, mainValue: values[0], length: 1 };
  }

  // 对子
  if (len === 2 && values.length === 1 && countValues2[0] === 2) {
    return { type: CARD_TYPE.PAIR, mainValue: values[0], length: 2 };
  }

  // 三张
  if (len === 3 && values.length === 1 && countValues2[0] === 3) {
    return { type: CARD_TYPE.TRIPLE, mainValue: values[0], length: 3 };
  }

  // 炸弹
  if (len === 4 && values.length === 1 && countValues2[0] === 4) {
    return { type: CARD_TYPE.BOMB, mainValue: values[0], length: 4 };
  }

  // 三带一
  if (len === 4 && values.length === 2) {
    const counts3 = Array.from(counts.entries());
    for (const [val, cnt] of counts3) {
      if (cnt === 3) {
        return { type: CARD_TYPE.TRIPLE_ONE, mainValue: val, length: 4 };
      }
    }
  }

  // 三带二
  if (len === 5 && values.length === 2) {
    const counts3 = Array.from(counts.entries());
    for (const [val, cnt] of counts3) {
      if (cnt === 3) {
        return { type: CARD_TYPE.TRIPLE_TWO, mainValue: val, length: 5 };
      }
    }
  }

  // 顺子：>=5张连续单牌，不含2和王
  if (len >= 5 && values.length === len) {
    const allSingle = countValues2.every(c => c === 1);
    const noSpecial = values.every(v => v >= 3 && v <= 14); // 不含2和王
    const isConsecutive = values[values.length - 1] - values[0] === len - 1;
    if (allSingle && noSpecial && isConsecutive) {
      return { type: CARD_TYPE.STRAIGHT, mainValue: values[0], length: len };
    }
  }

  // 连对：>=3对连续对子，不含2和王
  if (len >= 6 && len % 2 === 0) {
    const allPairs = countValues2.every(c => c === 2);
    const noSpecial = values.every(v => v >= 3 && v <= 14);
    const pairCount = len / 2;
    const isConsecutive = values[values.length - 1] - values[0] === pairCount - 1;
    if (allPairs && noSpecial && isConsecutive && values.length === pairCount) {
      return { type: CARD_TYPE.STRAIGHT_PAIR, mainValue: values[0], length: len };
    }
  }

  // 飞机（不带翅膀）：>=2个连续三张
  if (len >= 6 && len % 3 === 0) {
    const allTriples = countValues2.every(c => c === 3);
    const noSpecial = values.every(v => v >= 3 && v <= 14);
    const tripleCount = len / 3;
    const isConsecutive = values[values.length - 1] - values[0] === tripleCount - 1;
    if (allTriples && noSpecial && isConsecutive && values.length === tripleCount) {
      return { type: CARD_TYPE.PLANE, mainValue: values[0], length: len };
    }
  }

  // 飞机带单：连续三张数*4
  const planeResult = identifyPlane(cards, counts, values);
  if (planeResult) return planeResult;

  // 四带二（单牌或对子）
  const fourTwoResult = identifyFourTwo(cards, counts, values);
  if (fourTwoResult) return fourTwoResult;

  return { type: CARD_TYPE.INVALID };
}

/**
 * 识别飞机带翅膀
 */
function identifyPlane(cards, counts, values) {
  const len = cards.length;

  // 找出所有三张的牌值
  const triples = [];
  for (const [val, cnt] of counts) {
    if (cnt >= 3 && val >= 3 && val <= 14) {
      triples.push(val);
    }
  }
  triples.sort((a, b) => a - b);

  if (triples.length < 2) return null;

  // 找最长连续三张序列
  for (let start = 0; start < triples.length; start++) {
    for (let end = triples.length - 1; end > start; end--) {
      const seqLen = end - start + 1;
      const isConsecutive = triples[end] - triples[start] === seqLen - 1;

      if (!isConsecutive) continue;

      // 飞机带单：每个三张带一张单牌
      if (len === seqLen * 4) {
        return { type: CARD_TYPE.PLANE_ONE, mainValue: triples[start], length: len, planeCount: seqLen };
      }

      // 飞机带对：每个三张带一对
      if (len === seqLen * 5) {
        // 验证翅膀是对子
        const wings = new Map(counts);
        for (let i = start; i <= end; i++) {
          wings.set(triples[i], wings.get(triples[i]) - 3);
          if (wings.get(triples[i]) === 0) wings.delete(triples[i]);
        }
        const wingCounts = Array.from(wings.values());
        if (wingCounts.every(c => c === 2)) {
          return { type: CARD_TYPE.PLANE_TWO, mainValue: triples[start], length: len, planeCount: seqLen };
        }
      }
    }
  }

  return null;
}

/**
 * 识别四带二
 */
function identifyFourTwo(cards, counts, values) {
  const len = cards.length;
  if (len < 6 || len > 8) return null;

  // 找四张的牌值
  let fourValue = null;
  for (const [val, cnt] of counts) {
    if (cnt === 4) {
      fourValue = val;
      break;
    }
  }
  if (fourValue === null) return null;

  // 四带二单
  if (len === 6) {
    return { type: CARD_TYPE.FOUR_TWO, mainValue: fourValue, length: 6 };
  }

  // 四带二对
  if (len === 8) {
    const others = Array.from(counts.entries()).filter(([v, c]) => v !== fourValue);
    if (others.every(([v, c]) => c === 2)) {
      return { type: CARD_TYPE.FOUR_TWO, mainValue: fourValue, length: 8 };
    }
  }

  return null;
}

/**
 * 获取牌型的倍数
 * @param {string} type - 牌型
 * @returns {number}
 */
function getTypeMultiplier(type) {
  switch (type) {
    case CARD_TYPE.BOMB:
      return 2;
    case CARD_TYPE.ROCKET:
      return 2;
    default:
      return 1;
  }
}

module.exports = {
  CARD_TYPE,
  TYPE_NAMES,
  countValues,
  identifyType,
  getTypeMultiplier,
};
