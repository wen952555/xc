/**
 * Thirteen Cards (十三张 / 水镜十三水) Professional Rules & Scoring Engine
 * 包含：
 * 1. 头道(3张)、中道(5张)、尾道(5张) 精确牌型判定与全位比牌 (Tie-Breaking)
 * 2. 5张顺子/同花顺包括 A-2-3-4-5 (轮子顺) 判定
 * 3. 8人场双副牌专属 五同 (Five of a kind) 至尊判定
 * 4. 经典倒水 (相公) 严谨校验：尾道 >= 中道 >= 头道
 * 5. 道数特奖喜水：头道冲三(+3水/A冲三+5水)、头道对A(+1水)、中道葫芦(+2水)、中道铁支(+8水)、中道同花顺(+10水)、中道五同(+16水)、尾道铁支(+4水)、尾道同花顺(+5水)、尾道五同(+8水)
 * 6. 十三水著名特殊牌型 (至尊青龙+108水、一条龙+36水、十二皇族+24水、三同花顺+20水、三分天下+20水、四套三条+18水、凑一色+10水、全大/全小+10水、六对半+4水、三同花+3水、三顺子+3水)
 * 7. 两两对战全维度比水、打枪翻倍 (2x)、全垒打通关全场再翻倍 (2x)、相公倒水惩罚
 */

export interface SSSCard {
  id: string;
  rank: number; // 2..14 (14=A, 13=K... 2=2)
  suitVal: number; // 4=♠, 3=♥, 2=♣, 1=♦
  label: string;
  suit: '♠' | '♥' | '♣' | '♦';
  isRed: boolean;
}

export type TierRank =
  | 'five_of_a_kind'
  | 'straight_flush'
  | 'quads'
  | 'full_house'
  | 'flush'
  | 'straight'
  | 'triplet'
  | 'two_pairs'
  | 'pair'
  | 'high_card';

export interface EvaluatedTier {
  name: string;
  type: TierRank;
  scoreRank: number; // high-resolution numeric score for exact tie-breaking
  cards: SSSCard[];
  detailLabel: string;
}

export type SpecialHandType =
  | 'supreme_dragon' // 至尊青龙 (同花一条龙)
  | 'dragon' // 一条龙 (杂色一条龙)
  | 'twelve_royals' // 十二皇族 (全JQK以上)
  | 'three_straight_flushes' // 三同花顺
  | 'three_quads' // 三分天下 (三铁支)
  | 'four_triplets' // 四套三条
  | 'all_one_color' // 凑一色 (全红或全黑)
  | 'all_big' // 全大 (全部>=8)
  | 'all_small' // 全小 (全部<=8)
  | 'six_and_half_pairs' // 六对半 (6对+1单)
  | 'three_flushes' // 三同花
  | 'three_straights'; // 三顺子

export interface SpecialHandResult {
  type: SpecialHandType;
  name: string;
  bonusWater: number;
  desc: string;
}

/**
 * 校验5张牌牌型 (中道、尾道)
 */
export function evaluate5CardTier(cards: SSSCard[]): EvaluatedTier {
  if (cards.length !== 5) {
    return { name: '散牌', type: 'high_card', scoreRank: 0, cards, detailLabel: '缺牌' };
  }
  const sorted = [...cards].sort((a, b) => b.rank - a.rank || b.suitVal - a.suitVal);
  const isSameSuit = sorted.every((c) => c.suit === sorted[0].suit);

  // 顺子检测：标准顺子 或 A-2-3-4-5 (轮子顺)
  let isStraight = false;
  let straightHigh = 0;
  let standardStraight = true;
  for (let i = 1; i < 5; i++) {
    if (sorted[i].rank !== sorted[i - 1].rank - 1) {
      standardStraight = false;
      break;
    }
  }
  if (standardStraight) {
    isStraight = true;
    straightHigh = sorted[0].rank;
  } else if (
    sorted[0].rank === 14 &&
    sorted[1].rank === 5 &&
    sorted[2].rank === 4 &&
    sorted[3].rank === 3 &&
    sorted[4].rank === 2
  ) {
    // A-2-3-4-5 轮子顺子：最大牌算5
    isStraight = true;
    straightHigh = 5;
  }

  const counts: Record<number, number> = {};
  sorted.forEach((c) => (counts[c.rank] = (counts[c.rank] || 0) + 1));
  const entries = Object.entries(counts)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // 1. 五同 (Five of a Kind - 8人双副牌专用)
  if (entries[0].count >= 5) {
    const rk = entries[0].rank;
    return {
      name: '五同(五条)',
      type: 'five_of_a_kind',
      scoreRank: 100000000 + rk * 100,
      cards: sorted,
      detailLabel: `五条${getRankChar(rk)}`,
    };
  }

  // 2. 同花顺 (Straight Flush)
  if (isSameSuit && isStraight) {
    const topSuit = sorted[0].suitVal;
    return {
      name: '同花顺',
      type: 'straight_flush',
      scoreRank: 90000000 + straightHigh * 100 + topSuit,
      cards: sorted,
      detailLabel: `${sorted[0].suit}${straightHigh === 14 ? '皇家' : ''}同花顺`,
    };
  }

  // 3. 铁支 / 四条 (Four of a kind)
  if (entries[0].count === 4) {
    const quadRank = entries[0].rank;
    const kicker = entries[1] ? entries[1].rank : 0;
    return {
      name: '铁支(四条)',
      type: 'quads',
      scoreRank: 80000000 + quadRank * 100 + kicker,
      cards: sorted,
      detailLabel: `铁支${getRankChar(quadRank)}`,
    };
  }

  // 4. 葫芦 (Full house)
  if (entries[0].count === 3 && entries[1] && entries[1].count >= 2) {
    const tripRank = entries[0].rank;
    const pairRank = entries[1].rank;
    return {
      name: '葫芦',
      type: 'full_house',
      scoreRank: 70000000 + tripRank * 100 + pairRank,
      cards: sorted,
      detailLabel: `${getRankChar(tripRank)}葫芦`,
    };
  }

  // 5. 同花 (Flush)
  if (isSameSuit) {
    // 逐张比较所有5张牌大小
    const radix =
      sorted[0].rank * 50625 +
      sorted[1].rank * 3375 +
      sorted[2].rank * 225 +
      sorted[3].rank * 15 +
      sorted[4].rank;
    return {
      name: '同花',
      type: 'flush',
      scoreRank: 60000000 + radix + sorted[0].suitVal,
      cards: sorted,
      detailLabel: `${sorted[0].suit}同花${getRankChar(sorted[0].rank)}领衔`,
    };
  }

  // 6. 顺子 (Straight)
  if (isStraight) {
    const topSuit = sorted[0].suitVal;
    return {
      name: '顺子',
      type: 'straight',
      scoreRank: 50000000 + straightHigh * 10 + topSuit,
      cards: sorted,
      detailLabel: `${straightHigh === 14 ? 'A高' : `${getRankChar(straightHigh)}高`}顺子`,
    };
  }

  // 7. 三条 (Three of a kind)
  if (entries[0].count === 3) {
    const tripRank = entries[0].rank;
    const kickers = sorted.filter((c) => c.rank !== tripRank);
    const k1 = kickers[0]?.rank || 0;
    const k2 = kickers[1]?.rank || 0;
    return {
      name: '三条',
      type: 'triplet',
      scoreRank: 40000000 + tripRank * 1000 + k1 * 15 + k2,
      cards: sorted,
      detailLabel: `三条${getRankChar(tripRank)}`,
    };
  }

  // 8. 两对 (Two pairs)
  if (entries[0].count === 2 && entries[1] && entries[1].count === 2) {
    const highPair = Math.max(entries[0].rank, entries[1].rank);
    const lowPair = Math.min(entries[0].rank, entries[1].rank);
    const kicker = entries[2]?.rank || 0;
    return {
      name: '两对',
      type: 'two_pairs',
      scoreRank: 30000000 + highPair * 1000 + lowPair * 50 + kicker,
      cards: sorted,
      detailLabel: `${getRankChar(highPair)}配${getRankChar(lowPair)}两对`,
    };
  }

  // 9. 对子 (One pair)
  if (entries[0].count === 2) {
    const pairRank = entries[0].rank;
    const kickers = sorted.filter((c) => c.rank !== pairRank);
    const k1 = kickers[0]?.rank || 0;
    const k2 = kickers[1]?.rank || 0;
    const k3 = kickers[2]?.rank || 0;
    return {
      name: '对子',
      type: 'pair',
      scoreRank: 20000000 + pairRank * 1000 + k1 * 50 + k2 * 5 + k3,
      cards: sorted,
      detailLabel: `对${getRankChar(pairRank)}`,
    };
  }

  // 10. 散牌 / 乌龙 (High card)
  const radix =
    sorted[0].rank * 50625 +
    sorted[1].rank * 3375 +
    sorted[2].rank * 225 +
    sorted[3].rank * 15 +
    sorted[4].rank;
  return {
    name: '乌龙(散牌)',
    type: 'high_card',
    scoreRank: 10000000 + radix,
    cards: sorted,
    detailLabel: `${getRankChar(sorted[0].rank)}高散牌`,
  };
}

/**
 * 校验3张牌牌型 (头道)
 */
export function evaluate3CardTier(cards: SSSCard[]): EvaluatedTier {
  if (cards.length !== 3) {
    return { name: '散牌', type: 'high_card', scoreRank: 0, cards, detailLabel: '缺牌' };
  }
  const sorted = [...cards].sort((a, b) => b.rank - a.rank || b.suitVal - a.suitVal);

  // 冲三 (三条)
  if (sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank) {
    const rk = sorted[0].rank;
    return {
      name: rk === 14 ? '冲天三条A' : '冲三条',
      type: 'triplet',
      scoreRank: 40000000 + rk * 100,
      cards: sorted,
      detailLabel: `冲三${getRankChar(rk)}`,
    };
  }

  // 对子 (头对)
  if (sorted[0].rank === sorted[1].rank) {
    const pairRank = sorted[0].rank;
    const kicker = sorted[2].rank;
    return {
      name: pairRank === 14 ? '头道冲对A' : '头道对子',
      type: 'pair',
      scoreRank: 20000000 + pairRank * 1000 + kicker,
      cards: sorted,
      detailLabel: `对${getRankChar(pairRank)}带${getRankChar(kicker)}`,
    };
  }
  if (sorted[1].rank === sorted[2].rank) {
    const pairRank = sorted[1].rank;
    const kicker = sorted[0].rank;
    return {
      name: pairRank === 14 ? '头道冲对A' : '头道对子',
      type: 'pair',
      scoreRank: 20000000 + pairRank * 1000 + kicker,
      cards: sorted,
      detailLabel: `对${getRankChar(pairRank)}带${getRankChar(kicker)}`,
    };
  }

  // 乌龙散牌
  const radix = sorted[0].rank * 225 + sorted[1].rank * 15 + sorted[2].rank;
  return {
    name: '头道乌龙',
    type: 'high_card',
    scoreRank: 10000000 + radix,
    cards: sorted,
    detailLabel: `${getRankChar(sorted[0].rank)}高散牌`,
  };
}

function getRankChar(r: number): string {
  if (r === 14) return 'A';
  if (r === 13) return 'K';
  if (r === 12) return 'Q';
  if (r === 11) return 'J';
  if (r === 10) return '10';
  return String(r);
}

/**
 * 检测13张整手牌是否为特殊牌型 (Special Natural Hands)
 */
export function detectSpecialHand(cards: SSSCard[]): SpecialHandResult | null {
  if (cards.length !== 13) return null;
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);

  // 1. 至尊青龙 (同花十三水 / 清一色一条龙): 同花色 A到K
  const isAllSameSuit = cards.every((c) => c.suit === cards[0].suit);
  const ranksSet = new Set(cards.map((c) => c.rank));
  const hasAtoK = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].every((r) => ranksSet.has(r));

  if (isAllSameSuit && hasAtoK) {
    return {
      type: 'supreme_dragon',
      name: '至尊青龙',
      bonusWater: 108,
      desc: '同花一条龙 (A-K纯同花) · 胜全场 +108水',
    };
  }

  // 2. 一条龙 (杂色一条龙): A到K 各一张
  if (hasAtoK) {
    return {
      type: 'dragon',
      name: '一条龙',
      bonusWater: 36,
      desc: '杂色一条龙 (A-K连贯) · 胜全场 +36水',
    };
  }

  // 3. 十二皇族 (全大牌): 全部牌均为 J, Q, K, A (rank >= 11)
  const isAllRoyals = cards.every((c) => c.rank >= 11);
  if (isAllRoyals) {
    return {
      type: 'twelve_royals',
      name: '十二皇族',
      bonusWater: 24,
      desc: '十三张皆为J、Q、K、A · 胜全场 +24水',
    };
  }

  // 统计点数频次
  const counts: Record<number, number> = {};
  cards.forEach((c) => (counts[c.rank] = (counts[c.rank] || 0) + 1));
  const freqVals = Object.values(counts).sort((a, b) => b - a);

  // 4. 三分天下 (三铁支): 3个4条 + 1单张 (4, 4, 4, 1)
  if (freqVals[0] === 4 && freqVals[1] === 4 && freqVals[2] === 4) {
    return {
      type: 'three_quads',
      name: '三分天下(三铁支)',
      bonusWater: 20,
      desc: '独揽三副四条铁支 · 胜全场 +20水',
    };
  }

  // 5. 四套三条: 4组3条 + 1单张 (3, 3, 3, 3, 1)
  if (freqVals[0] === 3 && freqVals[1] === 3 && freqVals[2] === 3 && freqVals[3] === 3) {
    return {
      type: 'four_triplets',
      name: '四套三条',
      bonusWater: 18,
      desc: '坐拥四套三条 · 胜全场 +18水',
    };
  }

  // 6. 凑一色 (全红或全黑): 13张皆为红桃/方块 或皆为黑桃/草花
  const isAllRed = cards.every((c) => c.isRed);
  const isAllBlack = cards.every((c) => !c.isRed);
  if (isAllRed || isAllBlack) {
    return {
      type: 'all_one_color',
      name: isAllRed ? '凑一色(全红)' : '凑一色(全黑)',
      bonusWater: 10,
      desc: isAllRed ? '十三张纯红牌 · 胜全场 +10水' : '十三张纯黑牌 · 胜全场 +10水',
    };
  }

  // 7. 全大 (8..A) 或 全小 (2..8)
  const isAllBig = cards.every((c) => c.rank >= 8);
  const isAllSmall = cards.every((c) => c.rank <= 8);
  if (isAllBig) {
    return {
      type: 'all_big',
      name: '全大牌',
      bonusWater: 10,
      desc: '十三张点数全在8以上 · 胜全场 +10水',
    };
  }
  if (isAllSmall) {
    return {
      type: 'all_small',
      name: '全小牌',
      bonusWater: 10,
      desc: '十三张点数全在8以下 · 胜全场 +10水',
    };
  }

  // 8. 六对半: 6对 + 1单张 (2, 2, 2, 2, 2, 2, 1)
  const pairCount = freqVals.filter((cnt) => cnt >= 2).length;
  if (pairCount >= 6) {
    return {
      type: 'six_and_half_pairs',
      name: '六对半',
      bonusWater: 4,
      desc: '六对一单 · 胜全场 +4水',
    };
  }

  return null;
}

/**
 * 倒水 (相公) 严格判定
 * 规则：尾道 >= 中道 >= 头道
 */
export function isFoulHand(head: SSSCard[], mid: SSSCard[], tail: SSSCard[]): boolean {
  if (head.length !== 3 || mid.length !== 5 || tail.length !== 5) return false;
  const hEval = evaluate3CardTier(head);
  const mEval = evaluate5CardTier(mid);
  const tEval = evaluate5CardTier(tail);

  // 头道 > 中道 则倒水
  if (hEval.scoreRank > mEval.scoreRank) return true;
  // 中道 > 尾道 则倒水
  if (mEval.scoreRank > tEval.scoreRank) return true;

  return false;
}

/**
 * 道数特奖喜水计算 (Tier Bonus Water)
 */
export function getTierBonusWater(
  tierName: 'head' | 'mid' | 'tail',
  evalTier: EvaluatedTier
): { bonus: number; desc: string } {
  if (tierName === 'head') {
    if (evalTier.type === 'triplet') {
      const isAce = evalTier.scoreRank >= 40001400;
      return isAce
        ? { bonus: 5, desc: '头道冲天三条A (+5水)' }
        : { bonus: 3, desc: '头道冲三 (+3水)' };
    }
    if (evalTier.name.includes('冲对A')) {
      return { bonus: 1, desc: '头道冲对A (+1水)' };
    }
  } else if (tierName === 'mid') {
    if (evalTier.type === 'five_of_a_kind') {
      return { bonus: 16, desc: '中道五同至尊 (+16水)' };
    }
    if (evalTier.type === 'straight_flush') {
      return { bonus: 10, desc: '中道同花顺 (+10水)' };
    }
    if (evalTier.type === 'quads') {
      return { bonus: 8, desc: '中道铁支 (+8水)' };
    }
    if (evalTier.type === 'full_house') {
      return { bonus: 2, desc: '中道葫芦 (+2水)' };
    }
  } else if (tierName === 'tail') {
    if (evalTier.type === 'five_of_a_kind') {
      return { bonus: 8, desc: '尾道五同 (+8水)' };
    }
    if (evalTier.type === 'straight_flush') {
      return { bonus: 5, desc: '尾道同花顺 (+5水)' };
    }
    if (evalTier.type === 'quads') {
      return { bonus: 4, desc: '尾道铁支 (+4水)' };
    }
  }
  return { bonus: 0, desc: '' };
}

/**
 * 智能理牌策略算法 (Auto Arrange)
 */
export function autoArrangeThirteen(
  cards: SSSCard[],
  strategy: 'optimal' | 'solid' | 'flush' | 'balanced' = 'optimal'
): { head: SSSCard[]; mid: SSSCard[]; tail: SSSCard[] } {
  if (cards.length !== 13) {
    return { head: cards.slice(0, 3), mid: cards.slice(3, 8), tail: cards.slice(8, 13) };
  }

  const sorted = [...cards].sort((a, b) => b.rank - a.rank || b.suitVal - a.suitVal);
  const rankMap = new Map<number, SSSCard[]>();
  for (const c of sorted) {
    if (!rankMap.has(c.rank)) rankMap.set(c.rank, []);
    rankMap.get(c.rank)!.push(c);
  }

  // 1. 尝试找同花顺
  const suitMap = new Map<string, SSSCard[]>();
  for (const c of sorted) {
    if (!suitMap.has(c.suit)) suitMap.set(c.suit, []);
    suitMap.get(c.suit)!.push(c);
  }

  // 尝试找铁支 / 四条
  const quads: number[] = [];
  const triplets: number[] = [];
  const pairs: number[] = [];
  for (const [r, list] of rankMap.entries()) {
    if (list.length >= 4) quads.push(r);
    else if (list.length === 3) triplets.push(r);
    else if (list.length === 2) pairs.push(r);
  }
  quads.sort((a, b) => b - a);
  triplets.sort((a, b) => b - a);
  pairs.sort((a, b) => b - a);

  // 策略 A: 稳健葫芦 (尾道放葫芦/铁支，中道配好牌)
  if (strategy === 'solid' || strategy === 'optimal') {
    if (quads.length >= 1) {
      const qCards = rankMap.get(quads[0])!.slice(0, 4);
      const remaining = sorted.filter((c) => !qCards.some((qc) => qc.id === c.id));
      const tail = [...qCards, remaining[remaining.length - 1]];
      const rest = remaining.slice(0, remaining.length - 1);
      const mid = rest.slice(0, 5);
      const head = rest.slice(5, 8);
      if (!isFoulHand(head, mid, tail)) return { head, mid, tail };
    }

    if (triplets.length >= 1 && (pairs.length >= 1 || triplets.length >= 2)) {
      const tRank = triplets[0];
      const pRank = pairs.length >= 1 ? pairs[0] : triplets[1];
      const tailCards = [...rankMap.get(tRank)!.slice(0, 3), ...rankMap.get(pRank)!.slice(0, 2)];
      const remaining = sorted.filter((c) => !tailCards.some((tc) => tc.id === c.id));
      const mid = remaining.slice(0, 5);
      const head = remaining.slice(5, 8);
      if (!isFoulHand(head, mid, tailCards)) return { head, mid, tail: tailCards };
    }
  }

  // 策略 B: 同花攻势
  if (strategy === 'flush') {
    for (const [_, sCards] of suitMap.entries()) {
      if (sCards.length >= 5) {
        const tailCards = sCards.slice(0, 5);
        const remaining = sorted.filter((c) => !tailCards.some((tc) => tc.id === c.id));
        const mid = remaining.slice(0, 5);
        const head = remaining.slice(5, 8);
        if (!isFoulHand(head, mid, tailCards)) return { head, mid, tail: tailCards };
      }
    }
  }

  // 默认自高到低平顺排布：尾道取大牌，中道取中牌，头道取前牌
  const tail = sorted.slice(0, 5);
  const mid = sorted.slice(5, 10);
  const head = sorted.slice(10, 13);
  if (!isFoulHand(head, mid, tail)) {
    return { head, mid, tail };
  }

  // 反转排布
  const tail2 = sorted.slice(8, 13);
  const mid2 = sorted.slice(3, 8);
  const head2 = sorted.slice(0, 3);
  if (!isFoulHand(head2, mid2, tail2)) {
    return { head: head2, mid: mid2, tail: tail2 };
  }

  return { head: sorted.slice(0, 3), mid: sorted.slice(3, 8), tail: sorted.slice(8, 13) };
}

export interface TierMatchDetail {
  tierName: '头道' | '中道' | '尾道';
  myLabel: string;
  oppLabel: string;
  winner: 'me' | 'opp' | 'tie';
  baseWater: number;
  bonusWater: number;
  netWater: number;
  bonusDesc?: string;
}

export interface ThirteenVersusResult {
  oppSeat: number;
  oppName: string;
  tiers: TierMatchDetail[];
  isShot: boolean;
  isFoulOpp: boolean;
  isFoulMe: boolean;
  specialMe?: SpecialHandResult | null;
  specialOpp?: SpecialHandResult | null;
  rawWater: number;
  multiplier: number;
  finalWater: number;
  summary: string;
}

export interface ThirteenMatchSettlement {
  totalNetWater: number;
  isGrandSlam: boolean;
  wonCount: number;
  lostCount: number;
  versusResults: ThirteenVersusResult[];
}

/**
 * 两个玩家两两比牌计分算法 (Heads-up Comparison)
 */
export function compareTwoPlayers(
  myHand: { head: SSSCard[]; mid: SSSCard[]; tail: SSSCard[] },
  oppHand: { head: SSSCard[]; mid: SSSCard[]; tail: SSSCard[] },
  oppSeat: number = 1,
  oppName: string = '牌友'
): ThirteenVersusResult {
  const allMyCards = [...myHand.head, ...myHand.mid, ...myHand.tail];
  const allOppCards = [...oppHand.head, ...oppHand.mid, ...oppHand.tail];

  const specialMe = detectSpecialHand(allMyCards);
  const specialOpp = detectSpecialHand(allOppCards);

  // 特殊牌对战判定
  if (specialMe || specialOpp) {
    if (specialMe && specialOpp) {
      // 双方皆为特殊牌：比较特殊牌分数
      const delta = specialMe.bonusWater - specialOpp.bonusWater;
      return {
        oppSeat,
        oppName,
        tiers: [],
        isShot: false,
        isFoulOpp: false,
        isFoulMe: false,
        specialMe,
        specialOpp,
        rawWater: delta,
        multiplier: 1,
        finalWater: delta,
        summary: `双方皆为特殊牌！我方【${specialMe.name}】对战【${oppName}】的【${specialOpp.name}】，净胜 ${delta >= 0 ? `+${delta}` : delta} 水`,
      };
    }
    if (specialMe) {
      return {
        oppSeat,
        oppName,
        tiers: [],
        isShot: false,
        isFoulOpp: false,
        isFoulMe: false,
        specialMe,
        specialOpp: null,
        rawWater: specialMe.bonusWater,
        multiplier: 1,
        finalWater: specialMe.bonusWater,
        summary: `🎉 我方特殊牌【${specialMe.name}】免比三道！直取【${oppName}】+${specialMe.bonusWater} 水`,
      };
    }
    if (specialOpp) {
      return {
        oppSeat,
        oppName,
        tiers: [],
        isShot: false,
        isFoulOpp: false,
        isFoulMe: false,
        specialMe: null,
        specialOpp,
        rawWater: -specialOpp.bonusWater,
        multiplier: 1,
        finalWater: -specialOpp.bonusWater,
        summary: `【${oppName}】展出特殊牌【${specialOpp.name}】！我方输付 -${specialOpp.bonusWater} 水`,
      };
    }
  }

  const isFoulMe = isFoulHand(myHand.head, myHand.mid, myHand.tail);
  const isFoulOpp = isFoulHand(oppHand.head, oppHand.mid, oppHand.tail);

  // 双方都倒水：平局
  if (isFoulMe && isFoulOpp) {
    return {
      oppSeat,
      oppName,
      tiers: [],
      isShot: false,
      isFoulOpp: true,
      isFoulMe: true,
      rawWater: 0,
      multiplier: 1,
      finalWater: 0,
      summary: `双方均倒水犯规，按规则打和 0 水`,
    };
  }

  // 我倒水：算三道全输且被对方打枪，扣 3x2 = 6 水，并赔付对方三道可能享有的特奖喜水
  if (isFoulMe) {
    const oppH = evaluate3CardTier(oppHand.head);
    const oppM = evaluate5CardTier(oppHand.mid);
    const oppT = evaluate5CardTier(oppHand.tail);
    const oppBonus =
      getTierBonusWater('head', oppH).bonus +
      getTierBonusWater('mid', oppM).bonus +
      getTierBonusWater('tail', oppT).bonus;
    const finalW = -(6 + oppBonus);
    return {
      oppSeat,
      oppName,
      tiers: [],
      isShot: true,
      isFoulOpp: false,
      isFoulMe: true,
      rawWater: -3 - oppBonus,
      multiplier: 2,
      finalWater: finalW,
      summary: `我方摆牌倒水犯规！被【${oppName}】全胜打枪惩罚 ${finalW} 水`,
    };
  }

  // 对方倒水：算我三道全胜打枪对手，得 +6 水，且我方三道特奖喜水照算
  if (isFoulOpp) {
    const myH = evaluate3CardTier(myHand.head);
    const myM = evaluate5CardTier(myHand.mid);
    const myT = evaluate5CardTier(myHand.tail);
    const myBonus =
      getTierBonusWater('head', myH).bonus +
      getTierBonusWater('mid', myM).bonus +
      getTierBonusWater('tail', myT).bonus;
    const finalW = 6 + myBonus;
    return {
      oppSeat,
      oppName,
      tiers: [],
      isShot: true,
      isFoulOpp: true,
      isFoulMe: false,
      rawWater: 3 + myBonus,
      multiplier: 2,
      finalWater: finalW,
      summary: `【${oppName}】摆牌倒水犯规！我方全胜打枪进账 +${finalW} 水`,
    };
  }

  const myEvalHead = evaluate3CardTier(myHand.head);
  const oppEvalHead = evaluate3CardTier(oppHand.head);
  const myEvalMid = evaluate5CardTier(myHand.mid);
  const oppEvalMid = evaluate5CardTier(oppHand.mid);
  const myEvalTail = evaluate5CardTier(myHand.tail);
  const oppEvalTail = evaluate5CardTier(oppHand.tail);

  const tiers: TierMatchDetail[] = [];

  // 1. 头道比牌
  let headNet = 0;
  let headBonusDesc = '';
  if (myEvalHead.scoreRank > oppEvalHead.scoreRank) {
    const bonus = getTierBonusWater('head', myEvalHead);
    headNet = 1 + bonus.bonus;
    headBonusDesc = bonus.desc;
    tiers.push({
      tierName: '头道',
      myLabel: `${myEvalHead.name} (${myEvalHead.detailLabel})`,
      oppLabel: `${oppEvalHead.name} (${oppEvalHead.detailLabel})`,
      winner: 'me',
      baseWater: 1,
      bonusWater: bonus.bonus,
      netWater: headNet,
      bonusDesc: headBonusDesc,
    });
  } else if (myEvalHead.scoreRank < oppEvalHead.scoreRank) {
    const bonus = getTierBonusWater('head', oppEvalHead);
    headNet = -(1 + bonus.bonus);
    headBonusDesc = bonus.desc ? `对手${bonus.desc}` : '';
    tiers.push({
      tierName: '头道',
      myLabel: `${myEvalHead.name} (${myEvalHead.detailLabel})`,
      oppLabel: `${oppEvalHead.name} (${oppEvalHead.detailLabel})`,
      winner: 'opp',
      baseWater: -1,
      bonusWater: -bonus.bonus,
      netWater: headNet,
      bonusDesc: headBonusDesc,
    });
  } else {
    tiers.push({
      tierName: '头道',
      myLabel: `${myEvalHead.name} (${myEvalHead.detailLabel})`,
      oppLabel: `${oppEvalHead.name} (${oppEvalHead.detailLabel})`,
      winner: 'tie',
      baseWater: 0,
      bonusWater: 0,
      netWater: 0,
    });
  }

  // 2. 中道比牌
  let midNet = 0;
  let midBonusDesc = '';
  if (myEvalMid.scoreRank > oppEvalMid.scoreRank) {
    const bonus = getTierBonusWater('mid', myEvalMid);
    midNet = 1 + bonus.bonus;
    midBonusDesc = bonus.desc;
    tiers.push({
      tierName: '中道',
      myLabel: `${myEvalMid.name} (${myEvalMid.detailLabel})`,
      oppLabel: `${oppEvalMid.name} (${oppEvalMid.detailLabel})`,
      winner: 'me',
      baseWater: 1,
      bonusWater: bonus.bonus,
      netWater: midNet,
      bonusDesc: midBonusDesc,
    });
  } else if (myEvalMid.scoreRank < oppEvalMid.scoreRank) {
    const bonus = getTierBonusWater('mid', oppEvalMid);
    midNet = -(1 + bonus.bonus);
    midBonusDesc = bonus.desc ? `对手${bonus.desc}` : '';
    tiers.push({
      tierName: '中道',
      myLabel: `${myEvalMid.name} (${myEvalMid.detailLabel})`,
      oppLabel: `${oppEvalMid.name} (${oppEvalMid.detailLabel})`,
      winner: 'opp',
      baseWater: -1,
      bonusWater: -bonus.bonus,
      netWater: midNet,
      bonusDesc: midBonusDesc,
    });
  } else {
    tiers.push({
      tierName: '中道',
      myLabel: `${myEvalMid.name} (${myEvalMid.detailLabel})`,
      oppLabel: `${oppEvalMid.name} (${oppEvalMid.detailLabel})`,
      winner: 'tie',
      baseWater: 0,
      bonusWater: 0,
      netWater: 0,
    });
  }

  // 3. 尾道比牌
  let tailNet = 0;
  let tailBonusDesc = '';
  if (myEvalTail.scoreRank > oppEvalTail.scoreRank) {
    const bonus = getTierBonusWater('tail', myEvalTail);
    tailNet = 1 + bonus.bonus;
    tailBonusDesc = bonus.desc;
    tiers.push({
      tierName: '尾道',
      myLabel: `${myEvalTail.name} (${myEvalTail.detailLabel})`,
      oppLabel: `${oppEvalTail.name} (${oppEvalTail.detailLabel})`,
      winner: 'me',
      baseWater: 1,
      bonusWater: bonus.bonus,
      netWater: tailNet,
      bonusDesc: tailBonusDesc,
    });
  } else if (myEvalTail.scoreRank < oppEvalTail.scoreRank) {
    const bonus = getTierBonusWater('tail', oppEvalTail);
    tailNet = -(1 + bonus.bonus);
    tailBonusDesc = bonus.desc ? `对手${bonus.desc}` : '';
    tiers.push({
      tierName: '尾道',
      myLabel: `${myEvalTail.name} (${myEvalTail.detailLabel})`,
      oppLabel: `${oppEvalTail.name} (${oppEvalTail.detailLabel})`,
      winner: 'opp',
      baseWater: -1,
      bonusWater: -bonus.bonus,
      netWater: tailNet,
      bonusDesc: tailBonusDesc,
    });
  } else {
    tiers.push({
      tierName: '尾道',
      myLabel: `${myEvalTail.name} (${myEvalTail.detailLabel})`,
      oppLabel: `${oppEvalTail.name} (${oppEvalTail.detailLabel})`,
      winner: 'tie',
      baseWater: 0,
      bonusWater: 0,
      netWater: 0,
    });
  }

  const rawWater = headNet + midNet + tailNet;
  const myWonTiers = tiers.filter((t) => t.winner === 'me').length;
  const oppWonTiers = tiers.filter((t) => t.winner === 'opp').length;

  // 打枪判定：三道全胜对手
  const isShot = myWonTiers === 3;
  const isBeingShot = oppWonTiers === 3;

  let multiplier = 1;
  let finalWater = rawWater;

  if (isShot) {
    multiplier = 2;
    finalWater = rawWater * 2;
  } else if (isBeingShot) {
    multiplier = 2;
    finalWater = rawWater * 2;
  }

  let summary = '';
  if (isShot) {
    summary = `💥 打枪！三道全胜【${oppName}】，净水翻倍至 +${finalWater} 水`;
  } else if (isBeingShot) {
    summary = `🔫 被打枪！三道全负于【${oppName}】，负分翻倍至 ${finalWater} 水`;
  } else {
    summary =
      finalWater >= 0
        ? `两两对战【${oppName}】净胜 +${finalWater} 水`
        : `两两对战【${oppName}】净负 ${Math.abs(finalWater)} 水`;
  }

  return {
    oppSeat,
    oppName,
    tiers,
    isShot,
    isFoulOpp: false,
    isFoulMe: false,
    rawWater,
    multiplier,
    finalWater,
    summary,
  };
}
