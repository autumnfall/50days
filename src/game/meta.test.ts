// ============================================================
// 局外 meta 系统（传承点 / 天赋树 / 结算）单元测试
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  TALENTS, TALENT_POINT_CAP, TALENT_TREE_TOTAL_COST,
  canActivateTalent, deactivateTalent, defaultMeta, sanitizeTalents, settleRun, talentsCost,
} from './meta'
import { createGame } from './engine'
import type { GameState } from './engine'

function endedState(phase: 'victory' | 'defeat', day: number): GameState {
  return { ...createGame(), phase, day }
}

describe('天赋树规则常量', () => {
  it('全树总花费 80，30 点上限不可能点完一半天赋', () => {
    expect(TALENT_TREE_TOTAL_COST).toBe(80)
    expect(TALENT_POINT_CAP).toBe(30)
    expect(TALENT_POINT_CAP).toBeLessThanOrEqual(TALENT_TREE_TOTAL_COST / 2)
  })

  it('每条支线 5 层，费用 2/3/4/5/6，机制天赋在最后一层', () => {
    const branches = [...new Set(TALENTS.map((t) => t.branch))]
    expect(branches).toHaveLength(4)
    for (const b of branches) {
      const nodes = TALENTS.filter((t) => t.branch === b).sort((a, c) => a.tier - c.tier)
      expect(nodes.map((n) => n.cost)).toEqual([2, 3, 4, 5, 6])
      expect(nodes[4].mechanic).toBe(true)
      expect(nodes.slice(0, 4).every((n) => !n.mechanic)).toBe(true)
      // 链式前置
      for (let i = 1; i < nodes.length; i++) expect(nodes[i].requires).toBe(nodes[i - 1].id)
    }
  })
})

describe('配点校验', () => {
  it('前置未激活时不能激活后续天赋', () => {
    expect(canActivateTalent([], 'farm_hands', 30).ok).toBe(false)
    expect(canActivateTalent(['farm_cap'], 'farm_hands', 30).ok).toBe(true)
  })

  it('点数预算不足时不能激活', () => {
    expect(canActivateTalent([], 'spring_harvest', 30).ok).toBe(false) // 前置不足
    expect(canActivateTalent(['farm_cap'], 'farm_hands', 2).ok).toBe(false) // 预算不足
  })

  it('30 点最多点满一条线 + 另一线 T1T2', () => {
    const full = ['farm_cap', 'farm_hands', 'granary_start', 'rich_soil', 'spring_harvest']
    expect(talentsCost(full)).toBe(20)
    expect(canActivateTalent(full, 'industry_cap', 30).ok).toBe(true)
    expect(canActivateTalent([...full, 'industry_cap'], 'lumberjack', 30).ok).toBe(true)
    expect(canActivateTalent([...full, 'industry_cap', 'lumberjack'], 'rich_vein', 30).ok).toBe(true)
    expect(canActivateTalent([...full, 'industry_cap', 'lumberjack', 'rich_vein'], 'deep_mine', 30).ok).toBe(false)
  })

  it('取消激活会级联移除后续天赋', () => {
    const active = ['farm_cap', 'farm_hands', 'granary_start', 'house_cap']
    expect(deactivateTalent(active, 'farm_cap')).toEqual(['house_cap'])
    expect(deactivateTalent(active, 'farm_hands')).toEqual(['farm_cap', 'house_cap'])
  })

  it('sanitizeTalents 过滤未知 id 并修复非法配点', () => {
    expect(sanitizeTalents(['farm_hands', 'nope'], 30)).toEqual([]) // 缺前置
    expect(sanitizeTalents(['farm_cap', 'farm_hands'], 30)).toEqual(['farm_cap', 'farm_hands'])
    expect(sanitizeTalents(['farm_cap', 'farm_hands'], 2)).toEqual(['farm_cap']) // 预算只够 T1
  })
})

describe('局结束结算', () => {
  it('通关 +6 点，5 局点满 30 上限', () => {
    let meta = defaultMeta()
    for (let i = 0; i < 5; i++) {
      const r = settleRun(endedState('victory', 51), meta)
      meta = r.meta
    }
    expect(meta.earned).toBe(30)
    expect(meta.victories).toBe(5)
    expect(meta.runs).toBe(5)
  })

  it('败北按坚守天数保底：每 15 天 +1，最多 +3', () => {
    expect(settleRun(endedState('defeat', 10), defaultMeta()).rawGain).toBe(0)
    expect(settleRun(endedState('defeat', 20), defaultMeta()).rawGain).toBe(1)
    expect(settleRun(endedState('defeat', 30), defaultMeta()).rawGain).toBe(2)
    expect(settleRun(endedState('defeat', 50), defaultMeta()).rawGain).toBe(3)
  })

  it('触及上限后收益截断为 0', () => {
    const meta = { ...defaultMeta(), earned: 28 }
    const r = settleRun(endedState('victory', 51), meta)
    expect(r.rawGain).toBe(6)
    expect(r.gained).toBe(2)
    expect(r.meta.earned).toBe(30)
  })

  it('更新生涯记录', () => {
    const r = settleRun(endedState('defeat', 33), { ...defaultMeta(), runs: 2, bestDay: 40 })
    expect(r.meta.runs).toBe(3)
    expect(r.meta.bestDay).toBe(40)
  })
})
