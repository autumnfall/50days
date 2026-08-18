// ============================================================
// 肉鸽模式「无尽远征」单元测试 —— 种子可复现 / 祝福三选一 / 遗物 / 战场词条 / 结算
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  applyEventChoice, chooseNation, closeBattleReport, createGame, endTurn, hasRelic,
  buildCost, type GameState,
} from './engine'
import { BLESSINGS, CONFIG, getWave, type GameEvent } from './config'
import { RELICS } from './relics'
import { nextRandom } from './rng'
import { defaultMeta, ROGUE_POINTS_MAX, settleRun } from './meta'

/** 推进一天：自动关闭战报、自动选择第一个无门槛的事件选项 */
function advanceDay(s: GameState): GameState {
  let ns = endTurn(s)
  if (ns.phase === 'battle') ns = closeBattleReport(ns)
  if (ns.pendingEvent) {
    const choice = ns.pendingEvent.event.choices.find((c) => !c.reqResources && !c.reqSoldiers)
      ?? ns.pendingEvent.event.choices[0]
    ns = applyEventChoice(ns, choice.id)
  }
  return ns
}

function startRogue(seed: number): GameState {
  return chooseNation(createGame([], { mode: 'rogue', seed }), 'military')
}

/** 便于对比的可序列化快照 */
function snapshot(s: GameState): string {
  return JSON.stringify({ ...s, skills: [...s.skills], log: s.log.map((l) => `${l.day}:${l.text}`) })
}

describe('种子化 PRNG', () => {
  it('相同状态产生相同序列，不同种子产生不同序列', () => {
    const seq = (seed: number, n: number) => {
      const out: number[] = []
      let st = seed
      for (let i = 0; i < n; i++) {
        const r = nextRandom(st)
        out.push(r.value)
        st = r.state
      }
      return out
    }
    expect(seq(42, 8)).toEqual(seq(42, 8))
    expect(seq(42, 8)).not.toEqual(seq(43, 8))
    for (const v of seq(1, 100)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('无尽远征可复现性', () => {
  it('相同 seed + 相同操作 → 完全一致的局面', () => {
    let a = startRogue(20260806)
    let b = startRogue(20260806)
    for (let i = 0; i < 12 && a.phase !== 'defeat'; i++) {
      a = advanceDay(a)
      b = advanceDay(b)
    }
    expect(snapshot(a)).toBe(snapshot(b))
  })

  it('不同 seed 的开局进程不同', () => {
    let a = startRogue(1)
    let b = startRogue(999999)
    for (let i = 0; i < 12; i++) {
      a = advanceDay(a)
      b = advanceDay(b)
    }
    expect(snapshot(a)).not.toBe(snapshot(b))
  })
})

describe('远征祝福（每 3 天三选一）', () => {
  it(`第 ${CONFIG.rogue.blessingInterval} 天出现祝福三选一`, () => {
    let s = startRogue(7)
    while (s.day < CONFIG.rogue.blessingInterval && s.phase !== 'defeat') s = advanceDay(s)
    // advanceDay 会消费事件，需在祝福日当天停下检查——重新手动推进
    s = startRogue(7)
    s = advanceDay(s) // day 1 → 2
    let ns = endTurn(s) // day 2 → 3（祝福日）
    if (ns.phase === 'battle') ns = closeBattleReport(ns)
    expect(ns.day).toBe(CONFIG.rogue.blessingInterval)
    expect(ns.pendingEvent?.event.id).toBe('blessing')
    expect(ns.pendingEvent?.event.choices).toHaveLength(3)
    // 选项不重复
    const ids = ns.pendingEvent!.event.choices.map((c) => c.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('已拥有遗物的祝福不再出现在候选池', () => {
    let s = startRogue(7)
    // 集齐全部遗物
    s = { ...s, run: { ...s.run!, relics: Object.keys(RELICS) } }
    s = advanceDay(s)
    let ns = endTurn(s)
    if (ns.phase === 'battle') ns = closeBattleReport(ns)
    const choices = ns.pendingEvent?.event.choices ?? []
    expect(choices.length).toBeGreaterThan(0)
    expect(choices.every((c) => !c.effect.relic)).toBe(true)
  })
})

describe('遗物系统', () => {
  function grantRelic(s: GameState, relic: string): GameState {
    const event: GameEvent = {
      id: 'blessing', icon: '🎁', title: '远征祝福', text: '', kind: 'good', weight: 1,
      choices: [{ id: 'pick', label: 'pick', desc: '', effect: { relic } }],
    }
    return applyEventChoice({ ...s, pendingEvent: { event } }, 'pick')
  }

  it('选择祝福后获得遗物，hasRelic 生效且不重复', () => {
    let s = startRogue(7)
    expect(hasRelic(s, 'whetstone')).toBe(false)
    s = grantRelic(s, 'whetstone')
    expect(hasRelic(s, 'whetstone')).toBe(true)
    expect(s.run?.relics).toEqual(['whetstone'])
    s = grantRelic(s, 'whetstone')
    expect(s.run?.relics).toEqual(['whetstone'])
  })

  it('遗物「坚固图纸」使建筑费用 -10%', () => {
    let s = startRogue(7)
    const before = buildCost(s, 'farm').wood!
    s = grantRelic(s, 'sturdy_plans')
    const after = buildCost(s, 'farm').wood!
    expect(after).toBe(Math.max(1, Math.floor(before * 0.9)))
  })

  it('经典模式选择遗物祝福不会产生遗物', () => {
    let s = chooseNation(createGame([], { mode: 'classic', seed: 7 }), 'military')
    s = grantRelic(s, 'whetstone')
    expect(hasRelic(s, 'whetstone')).toBe(false)
  })
})

describe('无尽波次与战场词条', () => {
  it('Boss 日（每 25 天）必来强化 Boss 波且附带敌增益词条', () => {
    let s = startRogue(7)
    // 直接跳到 Boss 日前一天，给足兵力保证能扛过结算
    s = {
      ...s,
      day: CONFIG.rogue.bossInterval - 1,
      soldiers: { militia: 0, archer: 0, knight: 200, warlord: 0 },
      resources: { food: 99999, wood: 9999, gold: 9999 },
    }
    const ns = endTurn(s)
    expect(ns.day).toBe(CONFIG.rogue.bossInterval)
    expect(ns.wavesFaced).toBe(1)
    const report = ns.battle
    expect(report).not.toBeNull()
    expect(report!.wave.name).toContain('黑暗领主')
    expect(report!.modifier).toBeTruthy()
    expect(report!.modifier!.type).toBe('enemy_buff')
  })

  it('常规波次强度随天数递增（dayScaling）', () => {
    let s = startRogue(7)
    // 构造：第 30 天必来袭（lastWaveDay 拉远使概率拉满）
    s = { ...s, day: 29, lastWaveDay: 2, soldiers: { militia: 0, archer: 0, knight: 500, warlord: 0 }, resources: { food: 99999, wood: 0, gold: 0 } }
    const ns = endTurn(s)
    expect(ns.battle).not.toBeNull()
    const base = getWave(1)
    const scale = 1 + 30 * CONFIG.rogue.dayScaling
    // count 可能受词条 swarm 影响，这里断言不低于基础 × 天数系数（词条只增不减）
    expect(ns.battle!.wave.count).toBeGreaterThanOrEqual(Math.round(base.count * scale))
  })

  it('Boss 日未能击退黑暗领主则直接判负', () => {
    let s = startRogue(7)
    s = {
      ...s,
      day: CONFIG.rogue.bossInterval - 1,
      soldiers: { militia: 0, archer: 0, knight: 0, warlord: 0 },
      resources: { food: 99999, wood: 9999, gold: 9999 },
    }
    const ns = endTurn(s)
    expect(ns.day).toBe(CONFIG.rogue.bossInterval)
    expect(ns.phase).toBe('defeat')
    expect(ns.defeatReason).toContain('黑暗领主')
  })
})

describe('肉鸽结算', () => {
  it('按坚守天数与击退波次阶梯给点，并更新远征生涯', () => {
    const meta = defaultMeta()
    const s: GameState = { ...startRogue(7), phase: 'defeat', day: 35, wavesFaced: 10 }
    const result = settleRun(s, meta)
    expect(result.victory).toBe(false)
    expect(result.rawGain).toBe(Math.min(ROGUE_POINTS_MAX, Math.floor(35 / 10) + Math.floor(10 / 8))) // 3+1=4
    expect(result.meta.earned).toBe(result.gained)
    expect(result.meta.rogue.runs).toBe(1)
    expect(result.meta.rogue.bestDay).toBe(35)
    expect(result.meta.rogue.bestWave).toBe(10)
    // 经典生涯不被污染
    expect(result.meta.runs).toBe(0)
  })

  it('传承点不超过上限', () => {
    const meta = { ...defaultMeta(), earned: 29 }
    const s: GameState = { ...startRogue(7), phase: 'defeat', day: 999, wavesFaced: 999 }
    const result = settleRun(s, meta)
    expect(result.rawGain).toBe(ROGUE_POINTS_MAX)
    expect(result.meta.earned).toBe(30)
    expect(result.gained).toBe(1)
  })
})

describe('标准模式终局决战', () => {
  it('第 50 天终局 Boss 战败后，即使战后复活也会直接判负', () => {
    let s = chooseNation(createGame([], { mode: 'classic', seed: 7 }), 'military')
    s = {
      ...s,
      day: CONFIG.totalDays - 1,
      skills: new Set(['mi_soulguard']),
      villagers: 0,
      soldiers: { militia: 10, archer: 0, knight: 0, warlord: 0 },
      resources: { food: 99999, wood: 9999, gold: 9999 },
      buildings: { farm: 0, lumber: 0, mine: 0, house: 0, barracks: 0, wall: 0, tower: 0 },
    }
    const ns = endTurn(s)
    expect(ns.day).toBe(CONFIG.totalDays)
    expect(ns.phase).toBe('defeat')
    expect(ns.defeatReason).toContain('终局')
  })

  it('第 50 天终局 Boss 战胜后先展示战报，关闭战报后进入胜利', () => {
    let s = chooseNation(createGame([], { mode: 'classic', seed: 7 }), 'military')
    s = {
      ...s,
      day: CONFIG.totalDays - 1,
      soldiers: { militia: 0, archer: 0, knight: 500, warlord: 0 },
      resources: { food: 99999, wood: 9999, gold: 9999 },
    }
    const ns = endTurn(s)
    expect(ns.day).toBe(CONFIG.totalDays)
    expect(ns.phase).toBe('battle')
    expect(ns.battle?.won).toBe(true)
    expect(ns.defeatedFinalBoss).toBe(true)
    const after = closeBattleReport(ns)
    expect(after.phase).toBe('victory')
    expect(after.battle).toBeNull()
  })
})

describe('祝福池配置完整性', () => {
  it('所有遗物都有对应祝福，且祝福 id 唯一', () => {
    const ids = BLESSINGS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const relicId of Object.keys(RELICS)) {
      expect(BLESSINGS.some((b) => b.effect.relic === relicId)).toBe(true)
    }
  })
})
