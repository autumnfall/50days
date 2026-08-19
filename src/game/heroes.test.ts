// ============================================================
// 英雄系统单元测试 —— 升级双闸门 / 技能点 / 战功 / 三个被动 / 主动技挂起模型
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  activateHeroSkill, chooseNation, closeDungeonResult, createGame, endTurn, enterDungeon, learnHeroActive, learnHeroPassive,
  previewTurnIncome, upgradeHero, closeBattleReport, applyEventChoice, type GameState,
} from './engine'
import {
  ACTIVE_UNLOCK_LEVEL, HERO_MAX_LEVEL, HERO_XP_THRESHOLDS, applyBattleToHero, canActivateHeroSkill,
  canLearnActive, canLearnPassive, canUpgradeHero, createHeroState, heroGrowth, heroSkillPoints, heroUpgradeCost,
  type HeroState,
} from './heroes'

function startWithHero(seed = 12345): GameState {
  return chooseNation(createGame([], { mode: 'classic', seed, hero: 'limu' }), 'military')
}

function startWithHeroId(id: string, seed = 12345): GameState {
  return chooseNation(createGame([], { mode: 'classic', seed, hero: id }), 'military')
}

/** 直接改写英雄状态（测试构造用） */
function withHero(s: GameState, patch: Partial<HeroState>): GameState {
  return { ...s, hero: { ...s.hero!, ...patch } }
}

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

describe('英雄创建', () => {
  it('开局选择英雄 → 初始 Lv1，自带 1 技能点，战功 0', () => {
    const s = startWithHero()
    expect(s.hero).not.toBeNull()
    expect(s.hero!.id).toBe('limu')
    expect(s.hero!.level).toBe(1)
    expect(s.hero!.growth).toBe(0)
    expect(heroSkillPoints(s.hero!)).toBe(1)
    expect(s.log.some((l) => l.text.includes('李牧'))).toBe(true)
  })

  it('不选英雄 → hero 为 null', () => {
    const s = chooseNation(createGame([], { mode: 'classic', seed: 1 }), 'military')
    expect(s.hero).toBeNull()
  })
})

describe('经验与升级（经验+荣耀双闸门）', () => {
  it('经验曲线累计 63 点，满级 10 级', () => {
    expect(HERO_XP_THRESHOLDS.reduce((a, b) => a + b, 0)).toBe(63)
    expect(HERO_XP_THRESHOLDS).toHaveLength(HERO_MAX_LEVEL - 1)
  })

  it('每过一天经验 +1', () => {
    const s = startWithHero()
    const ns = advanceDay(s)
    expect(ns.hero!.xp).toBe(1)
  })

  it('经验不足不能升级；经验足够但荣耀不足也不能升级', () => {
    let s = startWithHero()
    s = withHero(s, { xp: 2 }) // 1→2 需要 3
    expect(canUpgradeHero(s.hero!, 99).ok).toBe(false)
    expect(upgradeHero({ ...s, honor: 99 }).hero!.level).toBe(1)

    s = withHero(s, { xp: 3 })
    expect(canUpgradeHero(s.hero!, 1).ok).toBe(false) // 1→2 需要 2 荣耀
    expect(canUpgradeHero(s.hero!, 2).ok).toBe(true)
  })

  it('升级扣荣耀、扣经验，等级 +1 且技能点 +1', () => {
    let s = startWithHero()
    s = { ...withHero(s, { xp: 3 }), honor: 10 }
    const ns = upgradeHero(s)
    expect(ns.hero!.level).toBe(2)
    expect(ns.hero!.xp).toBe(0)
    expect(ns.honor).toBe(10 - heroUpgradeCost(1))
    expect(heroSkillPoints(ns.hero!)).toBe(2) // Lv1 自带 1 点 + 升级 1 点
  })

  it('升级费用 = 当前等级 × 2，满级共 90 荣耀', () => {
    let total = 0
    for (let lv = 1; lv < HERO_MAX_LEVEL; lv++) total += heroUpgradeCost(lv)
    expect(total).toBe(90)
  })
})

describe('技能点与前置条件', () => {
  it('被动 2/3 级分别需要英雄 Lv3 / Lv5', () => {
    let hero = createHeroState('limu')
    hero = { ...hero, level: 2, passives: [1, 0, 0] } // 已投入 1 点，剩 1 点
    expect(canLearnPassive(hero, 0).ok).toBe(false) // 被动①升 2 级需 Lv3
    expect(canLearnPassive(hero, 0).reason).toContain('3')
    expect(canLearnPassive(hero, 1).ok).toBe(true) // 学新被动只需 Lv1

    hero = { ...hero, level: 4, passives: [2, 0, 0] }
    expect(canLearnPassive(hero, 0).ok).toBe(false) // 升 3 级需 Lv5
    hero = { ...hero, level: 5, passives: [2, 0, 0] }
    expect(canLearnPassive(hero, 0).ok).toBe(true)
  })

  it('技能点不足时不能学习', () => {
    const hero: HeroState = { ...createHeroState('limu'), level: 1, passives: [1, 0, 0] } // 点已用完
    expect(heroSkillPoints(hero)).toBe(0)
    expect(canLearnPassive(hero, 1).ok).toBe(false)
  })

  it('引擎学习被动消耗技能点并记录日志', () => {
    const s = startWithHero()
    const ns = learnHeroPassive(s, 1) // 屯田戍边
    expect(ns.hero!.passives).toEqual([0, 1, 0])
    expect(heroSkillPoints(ns.hero!)).toBe(0)
    expect(ns.log.some((l) => l.text.includes('屯田戍边'))).toBe(true)
  })
})

describe('主动技·大破匈奴', () => {
  it(`Lv${ACTIVE_UNLOCK_LEVEL} 才能学习，学习消耗 1 技能点`, () => {
    let s = startWithHero()
    s = withHero(s, { level: ACTIVE_UNLOCK_LEVEL - 1, passives: [0, 0, 0] })
    expect(canLearnActive(s.hero!).ok).toBe(false)

    s = withHero(s, { level: ACTIVE_UNLOCK_LEVEL })
    const ns = learnHeroActive(s)
    expect(ns.hero!.activeLearned).toBe(true)
    expect(heroSkillPoints(ns.hero!)).toBe(ACTIVE_UNLOCK_LEVEL - 1)
  })

  it('激活后挂起并进入 5 天冷却；挂起/冷却中不能再次激活（不可叠加）', () => {
    let s = startWithHero()
    s = withHero(s, { level: 6, activeLearned: true })
    const ns = activateHeroSkill(s)
    expect(ns.hero!.pendingSkill).toBe(true)
    expect(ns.hero!.skillCooldownUntil).toBe(ns.day + 5)

    // 挂起中不能再激活
    expect(canActivateHeroSkill(ns.hero!, ns.day).ok).toBe(false)
    // 冷却中不能再激活
    const cooling = { ...ns.hero!, pendingSkill: false }
    expect(canActivateHeroSkill(cooling, ns.day + 4).ok).toBe(false)
    expect(canActivateHeroSkill(cooling, ns.day + 5).ok).toBe(true)
  })

  it('未习得时不能激活', () => {
    const s = startWithHero()
    expect(canActivateHeroSkill(s.hero!, s.day).ok).toBe(false)
    expect(activateHeroSkill(s).hero!.pendingSkill).toBe(false)
  })
})

describe('战功（成长状态）', () => {
  it('胜利 +1 且经验 +1；失败 -2；下限 0', () => {
    const h = createHeroState('limu')
    const win = applyBattleToHero(h, true)
    expect(win.growth).toBe(1)
    expect(win.xp).toBe(1)
    const lose = applyBattleToHero({ ...h, growth: 1 }, false)
    expect(lose.growth).toBe(0)
    expect(lose.xp).toBe(0) // 战败不加经验
    expect(applyBattleToHero(h, false).growth).toBe(0) // 下限 0
  })

  it('战功上限 30，达到后胜利不再增长', () => {
    const h = createHeroState('limu')
    const capped = applyBattleToHero({ ...h, growth: 30 }, true)
    expect(capped.growth).toBe(30)
    expect(capped.xp).toBe(1) // 经验照常 +1
    const belowCap = applyBattleToHero({ ...h, growth: 29 }, true)
    expect(belowCap.growth).toBe(30)
  })

  it('地牢战斗胜利 → 战功 +1、经验 +1', () => {
    let s = startWithHero(777)
    s = { ...s, soldiers: { ...s.soldiers, knight: 200 } } // 碾压兵力确保通关
    const ns = enterDungeon(s, 1)
    expect(ns.phase).toBe('dungeon_result')
    expect(ns.dungeon.pendingResult!.won).toBe(true)
    expect(ns.hero!.growth).toBe(1)
    expect(ns.hero!.xp).toBe(1)
  })
})

describe('被动技能效果', () => {
  it('久经沙场：战功提升全体士兵攻击（地牢首轮伤害更高）', () => {
    const base = { ...startWithHero(555), soldiers: { militia: 30, archer: 0, knight: 0, warlord: 0 } }
    const a = enterDungeon(withHero(base, { passives: [0, 0, 0], growth: 0 }), 1)
    const b = enterDungeon(withHero(base, { passives: [1, 0, 0], growth: 10 }), 1) // +10% 攻击
    const dmgA = a.dungeon.pendingResult!.rounds[0].playerDmg
    const dmgB = b.dungeon.pendingResult!.rounds[0].playerDmg
    expect(dmgB).toBeGreaterThan(dmgA)
  })

  it('屯田戍边：每座民居 +N 食物且提升食物采集效率（体现在收入预览中）', () => {
    let s = startWithHero()
    s = { ...s, buildings: { ...s.buildings, house: 2 } }
    // 默认 3 名村民采食，百分比加成太小会向下取整到 0，所以增加采食人口让百分比可见
    s = { ...s, villagers: 50, assignment: { ...s.assignment, food: 50, wood: 0, gold: 0 } }
    const without = previewTurnIncome(withHero(s, { passives: [0, 0, 0] }))
    const withLv2 = previewTurnIncome(withHero(s, { passives: [0, 2, 0] }))
    // Lv2 + 2 民居 = +4% 食物采集，另有 +4 固定食物
    expect(withLv2.detail.foodGather).toBeGreaterThan(without.detail.foodGather + 4)
    expect(withLv2.detail.foodGather - without.detail.foodGather).toBe(
      Math.floor(without.detail.foodGather * 0.04) + 4,
    )
  })

  it('以少胜多：敌军数量超过我方士兵时我方伤害提升', () => {
    const base = { ...startWithHero(444), soldiers: { militia: 3, archer: 0, knight: 0, warlord: 0 } }
    const a = enterDungeon(withHero(base, { passives: [0, 0, 0] }), 1)
    const b = enterDungeon(withHero(base, { passives: [0, 0, 1] }), 1) // +15% 伤害
    const enemies = a.dungeon.pendingResult!.wave.count
    expect(enemies).toBeGreaterThan(3) // 前提：敌军数量确实超过我方
    expect(b.dungeon.pendingResult!.rounds[0].playerDmg).toBeGreaterThan(a.dungeon.pendingResult!.rounds[0].playerDmg)
  })
})

describe('主动技战斗触发', () => {
  it('李牧·伏击（地牢）：开战削减 15% 敌军、敌方首轮伤害为 0，触发后即消耗', () => {
    const base = { ...startWithHero(999), soldiers: { militia: 30, archer: 0, knight: 0, warlord: 0 } }
    const normal = enterDungeon(withHero(base, { activeLearned: true, pendingSkill: false }), 1)
    const ambush = enterDungeon(withHero(base, { activeLearned: true, pendingSkill: true }), 1)

    const normalCount = normal.dungeon.pendingResult!.wave.count
    const ambushCount = ambush.dungeon.pendingResult!.wave.count
    expect(ambushCount).toBe(Math.max(1, normalCount - Math.ceil(normalCount * 0.15)))
    expect(ambush.dungeon.pendingResult!.rounds[0].enemyDmg).toBe(0)
    expect(ambush.hero!.pendingSkill).toBe(false) // 已消耗
  })

  it('李牧·伏击（敌袭）：开战削减 15% 敌军、敌方首轮伤害为 0，触发后即消耗', () => {
    let s = startWithHero(2040)
    s = {
      ...s,
      day: 10,
      lastWaveDay: 0,
      wavesFaced: 0,
      soldiers: { militia: 30, archer: 0, knight: 0, warlord: 0 },
      hero: { ...s.hero!, level: 6, activeLearned: true, pendingSkill: true },
    }
    const normalState = { ...s, hero: { ...s.hero!, pendingSkill: false } }
    const normalRaw = endTurn(normalState)
    expect(normalRaw.phase).toBe('battle')

    const ambushRaw = endTurn(s)
    expect(ambushRaw.phase).toBe('battle')
    const normalCount = normalRaw.battle!.wave.count
    const ambushCount = ambushRaw.battle!.wave.count
    expect(ambushCount).toBe(Math.max(1, normalCount - Math.ceil(normalCount * 0.15)))
    expect(ambushRaw.battle!.rounds[0].enemyDmg).toBe(0)

    const ambush = closeBattleReport(ambushRaw)
    expect(ambush.hero!.pendingSkill).toBe(false)
  })

  it('诸葛亮·空城计（敌袭）：按筹谋吓退敌军并消耗一半筹谋', () => {
    let s = startWithHeroId('zhugeliang', 2041)
    s = {
      ...s,
      day: 10,
      lastWaveDay: 0,
      wavesFaced: 0,
      soldiers: { ...s.soldiers, militia: 10 },
      hero: { ...s.hero!, level: 6, activeLearned: true, pendingSkill: true, growth: 10 },
    }
    const normalState = { ...s, hero: { ...s.hero!, pendingSkill: false } }
    const normalRaw = endTurn(normalState)
    expect(normalRaw.phase).toBe('battle')

    const emptyCityRaw = endTurn(s)
    expect(emptyCityRaw.phase).toBe('battle')
    expect(emptyCityRaw.hero!.growth).toBe(5) // 消耗一半（向上取整）
    expect(emptyCityRaw.hero!.pendingSkill).toBe(false)
    expect(emptyCityRaw.battle!.wave.count).toBeLessThanOrEqual(normalRaw.battle!.wave.count)
  })

  it('诸葛亮·空城计不会在地牢被误消耗', () => {
    let s = startWithHeroId('zhugeliang', 2042)
    s = {
      ...s,
      soldiers: { ...s.soldiers, knight: 300 },
      hero: { ...s.hero!, level: 6, activeLearned: true, pendingSkill: true, growth: 10 },
      dungeon: { highestCleared: 0, dailyAttempted: false, pendingResult: null },
    }
    const ns = enterDungeon(s, 1)
    expect(ns.phase).toBe('dungeon_result')
    expect(ns.hero!.pendingSkill).toBe(true) // 空城计只应在敌袭触发
    expect(ns.hero!.growth).toBe(10)
  })

  it('列奥尼达·温泉关（敌袭）：触发后消耗挂起，城墙已破时首回合有备注', () => {
    let s = startWithHeroId('leonidas', 2043)
    s = {
      ...s,
      day: 10,
      lastWaveDay: 0,
      wavesFaced: 0,
      soldiers: { militia: 30, archer: 0, knight: 0, warlord: 0 },
      buildings: { ...s.buildings, wall: 0 }, // 无城墙，视为已破，触发温泉关备注
      hero: { ...s.hero!, level: 6, activeLearned: true, pendingSkill: true },
    }
    const ns = endTurn(s)
    expect(ns.phase).toBe('battle')
    expect(ns.hero!.pendingSkill).toBe(false)
    // 城墙已破且触发温泉关时，首回合战报会有备注
    expect(ns.battle!.rounds.some((r) => r.note?.includes('温泉关'))).toBe(true)
  })

  it('列奥尼达·温泉关不会在地牢被误消耗', () => {
    let s = startWithHeroId('leonidas', 2044)
    s = {
      ...s,
      soldiers: { ...s.soldiers, knight: 300 },
      hero: { ...s.hero!, level: 6, activeLearned: true, pendingSkill: true },
      dungeon: { highestCleared: 0, dailyAttempted: false, pendingResult: null },
    }
    const ns = enterDungeon(s, 1)
    expect(ns.phase).toBe('dungeon_result')
    expect(ns.hero!.pendingSkill).toBe(true) // 温泉关只应在敌袭触发
  })
})

describe('无尽地牢', () => {
  it('通关 10 层后可进入第 11 层，荣誉固定 3', () => {
    let s = startWithHero(2026)
    s = {
      ...s,
      soldiers: { ...s.soldiers, knight: 300 },
      dungeon: { highestCleared: 10, dailyAttempted: false, pendingResult: null },
    }
    const ns = enterDungeon(s, 11)
    expect(ns.phase).toBe('dungeon_result')
    expect(ns.dungeon.pendingResult!.floor).toBe(11)
    expect(ns.dungeon.pendingResult!.honorGained).toBe(3)
    expect(ns.dungeon.highestCleared).toBe(11)
  })

  it('未通关 10 层不能进入无尽', () => {
    let s = startWithHero(2026)
    s = { ...s, dungeon: { highestCleared: 9, dailyAttempted: false, pendingResult: null } }
    expect(enterDungeon(s, 11)).toBe(s)
  })
})

describe('霍去病 · 冠军侯', () => {
  it('征尘 = min(地牢最高通关层数, 10)', () => {
    let s = startWithHeroId('huoqubing', 1)
    expect(heroGrowth(s.hero!, s)).toBe(0)
    s = { ...s, dungeon: { ...s.dungeon, highestCleared: 7 } }
    expect(heroGrowth(s.hero!, s)).toBe(7)
    s = { ...s, dungeon: { ...s.dungeon, highestCleared: 15 } }
    expect(heroGrowth(s.hero!, s)).toBe(10)
  })

  it('封狼居胥：通关地牢额外获得 1/2/3 荣誉', () => {
    let s = startWithHeroId('huoqubing', 2027)
    s = {
      ...s,
      soldiers: { ...s.soldiers, knight: 300 },
      dungeon: { highestCleared: 0, dailyAttempted: false, pendingResult: null },
    }
    const base = enterDungeon(s, 1)
    const withPassive = enterDungeon(withHero(s, { passives: [3, 0, 0] }), 1)
    expect(withPassive.dungeon.pendingResult!.honorGained).toBe(base.dungeon.pendingResult!.honorGained + 3)
  })

  it('千里奔袭：激活后获得额外地牢次数，突破每日限制', () => {
    let s = startWithHeroId('huoqubing', 2028)
    s = {
      ...s,
      soldiers: { ...s.soldiers, knight: 300 },
      hero: { ...s.hero!, level: 6, activeLearned: true, passives: [0, 0, 0] },
      dungeon: { highestCleared: 0, dailyAttempted: true, pendingResult: null },
    }
    // 没有额外次数时无法进入
    expect(enterDungeon(s, 1)).toBe(s)
    const activated = activateHeroSkill(s)
    expect(activated.hero!.dungeonExtraCharges).toBe(1)
    expect(activated.hero!.pendingSkill).toBe(false) // 霍去病不挂起，立即生效
    const first = enterDungeon(activated, 1)
    expect(first.phase).toBe('dungeon_result')
    expect(first.hero!.dungeonExtraCharges).toBe(0)
    // 用掉后再次尝试失败
    expect(enterDungeon(first, 1)).toBe(first)
  })

  it('千里奔袭：先激活再首次挑战，仍可连续挑战两次', () => {
    let s = startWithHeroId('huoqubing', 2029)
    s = {
      ...s,
      soldiers: { ...s.soldiers, knight: 300 },
      hero: { ...s.hero!, level: 6, activeLearned: true, passives: [0, 0, 0] },
      dungeon: { highestCleared: 0, dailyAttempted: false, pendingResult: null },
    }
    const activated = activateHeroSkill(s)
    // 第一次用正常每日次数
    const first = enterDungeon(activated, 1)
    expect(first.phase).toBe('dungeon_result')
    expect(first.dungeon.dailyAttempted).toBe(true)
    expect(first.hero!.dungeonExtraCharges).toBe(1)
    // 关闭战报后第二次用额外次数
    const afterFirst = closeDungeonResult(first)
    const second = enterDungeon(afterFirst, 1)
    expect(second.phase).toBe('dungeon_result')
    expect(second.dungeon.dailyAttempted).toBe(true)
    expect(second.hero!.dungeonExtraCharges).toBe(0)
    // 第三次失败
    const afterSecond = closeDungeonResult(second)
    expect(enterDungeon(afterSecond, 1)).toBe(afterSecond)
  })
})

describe('诸葛亮 · 卧龙', () => {
  it('筹谋每天 +1 并封顶 10', () => {
    let s = startWithHeroId('zhugeliang', 2030)
    expect(heroGrowth(s.hero!, s)).toBe(0)
    s = advanceDay(s)
    expect(heroGrowth(s.hero!, s)).toBe(1)
    s = withHero(s, { growth: 9 })
    s = advanceDay(s)
    expect(heroGrowth(s.hero!, s)).toBe(10)
    s = advanceDay(s)
    expect(heroGrowth(s.hero!, s)).toBe(10)
  })

  it('草船借箭：敌袭来袭时按敌军数量获得木材', () => {
    let s = startWithHeroId('zhugeliang', 2032)
    s = { ...s, day: 10, lastWaveDay: 2, wavesFaced: 0, hero: { ...s.hero!, passives: [0, 0, 3] } }
    // 通过结束回合触发敌袭
    let ns = endTurn(s)
    if (ns.phase === 'battle') ns = closeBattleReport(ns)
    if (ns.pendingEvent) {
      const choice = ns.pendingEvent.event.choices.find((c) => !c.reqResources && !c.reqSoldiers) ?? ns.pendingEvent.event.choices[0]
      ns = applyEventChoice(ns, choice.id)
    }
    const gained = ns.resources.wood - s.resources.wood
    expect(gained).toBeGreaterThan(0)
    expect(ns.log.some((l) => l.text.includes('草船借箭'))).toBe(true)
  })
})

describe('列奥尼达 · 斯巴达之王', () => {
  it('士兵阵亡增加战意，且战意无上限', () => {
    let s = startWithHeroId('leonidas', 2033)
    s = {
      ...s,
      soldiers: { ...s.soldiers, militia: 10 },
      dungeon: { highestCleared: 4, dailyAttempted: false, pendingResult: null },
    }
    // 让士兵战败阵亡
    const ns = enterDungeon(s, 5)
    expect(ns.hero!.growth).toBeGreaterThan(0)
  })

  it('盾墙：战意提升士兵生命', () => {
    const base = { ...startWithHeroId('leonidas', 2034), soldiers: { militia: 30, archer: 0, knight: 0, warlord: 0 } }
    const a = enterDungeon(withHero(base, { passives: [0, 0, 0], growth: 0 }), 1)
    const b = enterDungeon(withHero(base, { passives: [1, 0, 0], growth: 20 }), 1)
    expect(b.dungeon.pendingResult!.rounds[0].enemyDmg).toBeLessThanOrEqual(a.dungeon.pendingResult!.rounds[0].enemyDmg)
  })

  it('殊死一搏：阵亡士兵对敌军造成亡语伤害', () => {
    let s = startWithHeroId('leonidas', 2035)
    s = {
      ...s,
      soldiers: { ...s.soldiers, militia: 10 },
      hero: { ...s.hero!, passives: [0, 3, 0] },
      dungeon: { highestCleared: 4, dailyAttempted: false, pendingResult: null },
    }
    const ns = enterDungeon(s, 5)
    expect(ns.dungeon.pendingResult!.rounds.some((r) => r.note?.includes('殊死一搏'))).toBe(true)
  })
})
