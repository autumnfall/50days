// ============================================================
// 局外天赋注入引擎的单元测试
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  applyEventChoice, build, chooseNation, closeBattleReport, closeDungeonResult, createGame, endTurn,
  effectiveMax, gatherPerPerson, buildCost, towerDmg, train, unitAtk, unitHp, wallAbsorb,
  type GameState,
} from './engine'
import { UNITS } from './config'

const BASE = {
  farm: ['farm_cap'],
  hands: ['farm_hands'],
  soil: ['rich_soil'],
  spring: ['spring_harvest'],
  indCap: ['industry_cap'],
  lumber: ['lumberjack'],
  vein: ['rich_vein'],
  mine: ['deep_mine'],
  half: ['half_scaling'],
  house: ['house_cap'],
  reinforce: ['reinforce'],
  marksman: ['marksman'],
  bastion: ['bastion_cap'],
  volley: ['arrow_volley'],
  militia: ['militia_start'],
  drill: ['drill'],
  armor: ['armor'],
  economy: ['militia_economy'],
  warlord: ['warlord'],
}

describe('开局注入', () => {
  it('余粮/富矿/募兵天赋改变开局资源与军队', () => {
    const s = createGame([...BASE.vein, 'granary_start', ...BASE.militia])
    expect(s.resources).toEqual({ food: 60, wood: 45, gold: 30 })
    expect(s.soldiers.militia).toBe(2)
    expect(s.talents).toHaveLength(3)
  })

  it('无天赋时开局不变（向后兼容）', () => {
    const s = createGame()
    expect(s.resources).toEqual({ food: 40, wood: 30, gold: 20 })
    expect(s.soldiers).toEqual({ militia: 0, archer: 0, knight: 0, warlord: 0 })
    expect(s.talents).toEqual([])
  })
})

describe('建筑上限天赋', () => {
  it('开垦/扩建/民居扩建/壁垒扩建/战神提升对应上限', () => {
    const s = createGame([...BASE.farm, ...BASE.indCap, ...BASE.house, ...BASE.bastion, ...BASE.warlord])
    expect(effectiveMax(s, 'farm')).toBe(7)
    expect(effectiveMax(s, 'lumber')).toBe(6)
    expect(effectiveMax(s, 'mine')).toBe(6)
    expect(effectiveMax(s, 'house')).toBe(9)
    expect(effectiveMax(s, 'wall')).toBe(6)
    expect(effectiveMax(s, 'tower')).toBe(6)
    expect(effectiveMax(s, 'barracks')).toBe(4)
  })

  it('无天赋时兵营上限仍为 3', () => {
    expect(effectiveMax(createGame(), 'barracks')).toBe(3)
  })
})

describe('产能天赋', () => {
  it('精耕/沃土/匠作/深矿反映到每人产出', () => {
    let s = createGame([...BASE.hands, ...BASE.soil, ...BASE.lumber, ...BASE.mine])
    s = { ...s, buildings: { ...s.buildings, farm: 2, lumber: 2, mine: 1 } }
    const { foodPer, woodPer, goldPer } = gatherPerPerson(s)
    expect(foodPer).toBe(4 + 2 * 3 + 1) // 基础4 + 2级农场×3（沃土） + 精耕1
    expect(woodPer).toBe(3 + 2 + 1)
    expect(goldPer).toBe(3 + 1 + 1)
  })

  it('义勇：每名民兵回合结束全资源 +2，且不吃百分比加成', () => {
    let s = chooseNation(createGame(BASE.economy), 'military')
    s = {
      ...s,
      resources: { food: 50, wood: 0, gold: 0 },
      assignment: { food: 0, wood: 0, gold: 0 },
      soldiers: { ...s.soldiers, militia: 5 },
    }
    const ns = endTurn(s)
    // 食物：50 + 义勇10 - upkeep(6村民×2 + 5民兵×3 = 27) = 33
    expect(ns.resources.food).toBe(33)
    expect(ns.resources.wood).toBe(10)
    expect(ns.resources.gold).toBe(10)
  })

  it('春播秋收：第 10 天农场免费 +1 级，可突破上限', () => {
    let s = chooseNation(createGame(BASE.spring), 'military')
    s = { ...s, resources: { food: 9999, wood: 999, gold: 999 }, lastWaveDay: 999 }
    for (let i = 0; i < 9; i++) {
      if (s.pendingEvent) s = applyEventChoice(s, s.pendingEvent.event.choices[0].id)
      s = endTurn(s)
      if (s.phase === 'battle') s = closeBattleReport(s)
    }
    expect(s.day).toBe(10)
    expect(s.buildings.farm).toBe(1)
    // 上限之上仍可自动生长：把农场堆到上限后再过 10 天
    s = { ...s, buildings: { ...s.buildings, farm: effectiveMax(s, 'farm') } }
    for (let i = 0; i < 10; i++) {
      if (s.pendingEvent) s = applyEventChoice(s, s.pendingEvent.event.choices[0].id)
      s = endTurn(s)
      if (s.phase === 'battle') s = closeBattleReport(s)
    }
    expect(s.buildings.farm).toBe(effectiveMax(s, 'farm') + 1)
  })
})

describe('防御天赋', () => {
  it('加固/射术/箭阵', () => {
    let s = createGame([...BASE.reinforce, ...BASE.marksman, ...BASE.volley])
    s = { ...s, buildings: { ...s.buildings, wall: 3, tower: 2 } }
    expect(wallAbsorb(s)).toBe(45)
    expect(towerDmg(s)).toBe(10 + 4 + 2 * 5) // 基础10 + 射术4 + 箭阵2×(3墙+2塔)
  })
})

describe('营造法式（建筑加价减半）', () => {
  it('农场第 3 级费用从 20 降至 8 + ⌈12/2⌉ = 14', () => {
    let s = createGame(BASE.half)
    s = { ...s, buildings: { ...s.buildings, farm: 2 } }
    expect(buildCost(s, 'farm')).toEqual({ wood: 14 })
  })

  it('1 级价格不受影响', () => {
    const s = createGame(BASE.half)
    expect(buildCost(s, 'farm')).toEqual({ wood: 8 })
  })

  it('无天赋时维持原价', () => {
    let s = createGame()
    s = { ...s, buildings: { ...s.buildings, farm: 2 } }
    expect(buildCost(s, 'farm')).toEqual({ wood: 20 })
  })
})

describe('战神兵种', () => {
  it('基础属性 = 民兵+弓手+骑士各 1 名之和（39 攻 / 47 血）', () => {
    const s = createGame()
    expect(unitAtk(s, 'warlord')).toBe(UNITS.militia.atk + UNITS.archer.atk + UNITS.knight.atk)
    expect(unitHp(s, 'warlord')).toBe(UNITS.militia.hp + UNITS.archer.hp + UNITS.knight.hp)
    expect(unitAtk(s, 'warlord')).toBe(39)
    expect(unitHp(s, 'warlord')).toBe(47)
  })

  it('其他兵种的科技/天赋加成通过快照传导，不重复结算', () => {
    const s = createGame([...BASE.drill, ...BASE.armor])
    // 操练 +1 攻 ×3 兵种 → 42；甲胄 +3 血 ×3 兵种 → 56
    expect(unitAtk(s, 'warlord')).toBe(42)
    expect(unitHp(s, 'warlord')).toBe(56)
    const skilled: GameState = { ...s, skills: new Set(['mi_drill', 'mi_armor']) }
    expect(unitAtk(skilled, 'warlord')).toBe(45)
    expect(unitHp(skilled, 'warlord')).toBe(68)
  })

  it('兵营 Lv4 需要战神天赋，且战神全局唯一', () => {
    // 无天赋：兵营升不到 Lv4，无法训练战神
    let s = chooseNation(createGame(), 'military')
    s = { ...s, resources: { food: 999, wood: 999, gold: 999 } }
    s = build(build(build(s, 'barracks'), 'barracks'), 'barracks')
    expect(s.buildings.barracks).toBe(3)
    s = build(s, 'barracks')
    expect(s.buildings.barracks).toBe(3)
    const blocked = train(s, 'warlord')
    expect(blocked.soldiers.warlord).toBe(0)

    // 有天赋：可升 Lv4 并训练，第二次训练被拒绝
    let t = chooseNation(createGame(BASE.warlord), 'military')
    t = { ...t, resources: { food: 999, wood: 999, gold: 999 } }
    expect(t.buildings.barracks).toBe(1) // 军事国自带
    t = build(build(build(t, 'barracks'), 'barracks'), 'barracks')
    expect(t.buildings.barracks).toBe(4)
    const villagersBefore = t.villagers
    t = train(t, 'warlord')
    expect(t.soldiers.warlord).toBe(1)
    expect(t.villagers).toBe(villagersBefore - 1) // 1 名村民化身战神
    t = train(t, 'warlord')
    expect(t.soldiers.warlord).toBe(1)
  })
})

describe('整局冒烟：携带全流派天赋跑完 50 天不崩溃', () => {
  it('full run', () => {
    const talents = [
      'farm_cap', 'farm_hands', 'granary_start', 'rich_soil', 'spring_harvest',
      'industry_cap', 'lumberjack', 'rich_vein',
      'militia_start', 'drill', 'armor', 'militia_economy', 'warlord',
    ]
    let s = chooseNation(createGame(talents), 'military')
    for (let i = 0; i < 200 && s.phase !== 'victory' && s.phase !== 'defeat'; i++) {
      if (s.phase === 'battle') { s = closeBattleReport(s); continue }
      if (s.phase === 'dungeon_result') { s = closeDungeonResult(s); continue }
      if (s.pendingEvent) {
        const c = s.pendingEvent.event.choices[s.pendingEvent.event.choices.length - 1]
        s = applyEventChoice(s, c.id)
        if (s.pendingEvent) s = { ...s, pendingEvent: null } // 门槛不满足则强制跳过
        continue
      }
      // 简单策略：补资源、盖兵营/农场/民居、训练最强兵种
      s = { ...s, resources: { food: s.resources.food + 60, wood: s.resources.wood + 40, gold: s.resources.gold + 30 } }
      for (const b of ['barracks', 'farm', 'house', 'wall', 'tower'] as const) {
        if (s.buildings[b] < effectiveMax(s, b)) { s = build(s, b); break }
      }
      for (const u of ['warlord', 'knight', 'archer', 'militia'] as const) s = train(s, u)
      s = endTurn(s)
    }
    expect(['victory', 'defeat']).toContain(s.phase)
  })
})
