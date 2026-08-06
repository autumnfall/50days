// ============================================================
// 种子化伪随机数生成器 —— 纯函数，状态可序列化（肉鸽模式可复现 run）
// ============================================================

/**
 * mulberry32：推进 PRNG 状态一步，返回 [0,1) 随机数与新状态。
 * 纯函数：相同 state 必得相同结果，state 是纯 number 可直接存入 GameState。
 */
export function nextRandom(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0
  let r = next
  r = Math.imul(r ^ (r >>> 15), r | 1)
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296
  return { value, state: next }
}

/** 生成一个随机初始种子（用于新开局；非游戏内随机源，无需可复现） */
export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
}

/** 种子的展示形式（短码，便于分享/复盘） */
export function formatSeed(seed: number): string {
  return seed.toString(36).toUpperCase().padStart(6, '0')
}
