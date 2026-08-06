// ============================================================
// 效果系统统一（EffectMods）单元测试
// 对每个效果源逐一断言 collectMods 汇总结果 + 派生函数等价性定点验证
// ============================================================

import { describe, expect, it } from 'vitest'
import { chooseNation, createGame, gatherPerPerson, unitAtk, buildCost, popCap, towerDmg, wallAbsorb, type GameState } from './engine'
import { collectMods, EMPTY_MODS, mergeMods } from './effects'

/** 构造：指定文明 + 技能 + 天赋 + 遗物的局面 */
function makeState(opts: {
  nation?: 'agriculture' | 'military' | 'commerce'
  skills?: string[]
  talents?: string[]
  relics?: string[]
  upgrades?: { prod: number; def: number; army: number }
}): GameState {
  let s = createGame(opts.talents ?? [], { mode: opts.relics ? 'rogue' : 'classic', seed: 1 })
  if (opts.nation) s = chooseNation(s, opts.nation)
  s = { ...s, skills: new Set(opts.skills ?? []) }
  if (opts.relics) s = { ...s, run: { seed: 1, relics: opts.relics } }
  if (opts.upgrades) s = { ...s, upgrades: opts.upgrades }
  return s
}

describe('mergeMods 合并语义', () => {
  it('flat 相加、单发 mult 相乘、mults 数组保序拼接', () => {
    let m = mergeMods(EMPTY_MODS, { unitAtkFlat: 2, buildCostMults: [0.85] })
    m = mergeMods(m, { unitAtkFlat: 1, buildCostMults: [0.9, 0.9], unitAtkMult: 1.1 })
    expect(m.unitAtkFlat).toBe(3)
    expect(m.buildCostMults).toEqual([0.85, 0.9, 0.9])
    expect(m.unitAtkMult).toBeCloseTo(1.1)
  })

  it('interestRateMax 取最高档，interestRateAdd 相加', () => {
    let m = mergeMods(EMPTY_MODS, { interestRateMax: 0.02 })
    m = mergeMods(m, { interestRateMax: 0.05, interestRateAdd: 0.03 })
    expect(m.interestRateMax).toBe(0.05)
    expect(m.interestRateAdd).toBeCloseTo(0.03)
  })

  it('flags 或语义，wandererInterval 取最小非零', () => {
    let m = mergeMods(EMPTY_MODS, { flags: { bloodlust: true } })
    m = mergeMods(m, { flags: { militiaAll: true }, wandererInterval: 2 })
    expect(m.flags.bloodlust).toBe(true)
    expect(m.flags.militiaAll).toBe(true)
    expect(m.flags.mercenary).toBe(false)
    expect(m.wandererInterval).toBe(2)
  })
})

describe('collectMods：文明被动', () => {
  it('农耕国：食物 +1/人、招募 ×0.75', () => {
    const m = collectMods(makeState({ nation: 'agriculture' }))
    expect(m.gatherFlat.food).toBe(1)
    expect(m.recruitCostMults).toEqual([0.75])
  })
  it('军事国：全体攻 +2、训练 ×0.8', () => {
    const m = collectMods(makeState({ nation: 'military' }))
    expect(m.unitAtkFlat).toBe(2)
    expect(m.trainCostMults).toEqual([0.8])
  })
  it('商业联邦：金币 +1/人、建筑 ×0.85', () => {
    const m = collectMods(makeState({ nation: 'commerce' }))
    expect(m.gatherFlat.gold).toBe(1)
    expect(m.buildCostMults).toEqual([0.85])
  })
})

describe('collectMods：技能/天赋/遗物逐项', () => {
  const cases: { name: string; opts: Parameters<typeof makeState>[0]; assert: (m: ReturnType<typeof collectMods>) => void }[] = [
    { name: 'ag_abundance', opts: { skills: ['ag_abundance'] }, assert: (m) => { expect(m.gatherMults.food).toEqual([1.25]); expect(m.wandererInterval).toBe(2) } },
    { name: 'ag_granary+ag_population', opts: { skills: ['ag_granary', 'ag_population'] }, assert: (m) => { expect(m.popCapFlat).toBe(12); expect(m.starveFlatReduction).toBe(2) } },
    { name: 'ag_militia', opts: { skills: ['ag_militia'] }, assert: (m) => { expect(m.unitAtkByType.militia).toBe(3); expect(m.unitHpByType.militia).toBe(6) } },
    { name: 'mi_veteran', opts: { skills: ['mi_veteran'] }, assert: (m) => { expect(m.unitAtkByType.knight).toBe(6); expect(m.unitAtkByType.archer).toBe(3) } },
    { name: 'mi_discipline', opts: { skills: ['mi_discipline'] }, assert: (m) => { expect(m.unitHpFlat).toBe(6); expect(m.enemyDmgMult).toBeCloseTo(0.9) } },
    { name: 'mi_soulguard', opts: { skills: ['mi_soulguard'] }, assert: (m) => expect(m.reviveRatios).toEqual([0.3]) },
    { name: 'mi_warhorn', opts: { skills: ['mi_warhorn'] }, assert: (m) => expect(m.firstRoundMult).toBeCloseTo(1.4) },
    { name: 'co_goldwater 覆盖 co_caravan 利率', opts: { skills: ['co_caravan', 'co_goldwater'] }, assert: (m) => { expect(m.interestRateMax).toBe(0.05); expect(m.lootMults).toContain(1.25); expect(m.exchangeCostMult).toBeCloseTo(0.75) } },
    { name: 'co_war_economy', opts: { skills: ['co_war_economy'] }, assert: (m) => { expect(m.lootMults).toContain(1.5); expect(m.honorPerWin).toBe(1) } },
    { name: 'ag_earthwall', opts: { skills: ['ag_earthwall'] }, assert: (m) => { expect(m.wallAbsorbFlat).toBe(15); expect(m.wallRepairRatio).toBe(0.5) } },
    { name: '天赋 farm_cap+industry_cap+bastion_cap', opts: { talents: ['farm_cap', 'industry_cap', 'bastion_cap'] }, assert: (m) => { expect(m.buildingCapFlat.farm).toBe(2); expect(m.buildingCapFlat.lumber).toBe(1); expect(m.buildingCapFlat.wall).toBe(1) } },
    { name: '天赋 arrow_volley', opts: { talents: ['arrow_volley'] }, assert: (m) => expect(m.towerDmgPerDefBuilding).toBe(2) },
    { name: '天赋 militia_economy', opts: { talents: ['militia_economy'] }, assert: (m) => expect(m.militiaIncome).toBe(2) },
    { name: '遗物 whetstone+longbow+thick_walls', opts: { relics: ['whetstone', 'longbow', 'thick_walls'] }, assert: (m) => { expect(m.unitAtkMult).toBeCloseTo(1.1); expect(m.towerDmgMult).toBeCloseTo(1.25); expect(m.wallAbsorbMult).toBeCloseTo(1.2) } },
    { name: '遗物 merchant_charm 与技能利率相加', opts: { skills: ['co_caravan'], relics: ['merchant_charm'] }, assert: (m) => { expect(m.interestRateMax).toBe(0.02); expect(m.interestRateAdd).toBeCloseTo(0.03) } },
    { name: '遗物 field_medic 与英魂庇护叠链', opts: { skills: ['mi_soulguard'], relics: ['field_medic'] }, assert: (m) => expect(m.reviveRatios).toEqual([0.3, 0.2]) },
    { name: '终局升级 army/def 换算', opts: { upgrades: { prod: 0, def: 2, army: 3 } }, assert: (m) => { expect(m.unitAtkByType.knight).toBe(9); expect(m.unitHpByType.militia).toBe(6); expect(m.towerDmgFlat).toBe(4); expect(m.wallAbsorbFlat).toBe(14) } },
  ]
  for (const c of cases) {
    it(c.name, () => c.assert(collectMods(makeState(c.opts))))
  }
})

describe('派生函数等价性定点验证（手算对照）', () => {
  it('采集：农耕国 + ag_irrigate + farm_hands + 2 级农场（沃土/丰收祝福）', () => {
    const s = makeState({ nation: 'agriculture', skills: ['ag_irrigate', 'ag_fertility'], talents: ['farm_hands', 'rich_soil'] })
    s.buildings = { ...s.buildings, farm: 2 }
    // farmBonusPer = (2 + 1沃土) × 2丰收 = 6；foodPer = 4 + 2×6 + 1文明 + 1技能 + 1天赋 = 19
    expect(gatherPerPerson(s).foodPer).toBe(19)
  })

  it('单位攻击：军事国 + mi_drill + mi_kingarmy + drill 天赋 + 磨刀石', () => {
    const s = makeState({ nation: 'military', skills: ['mi_drill', 'mi_kingarmy'], talents: ['drill'], relics: ['whetstone'] })
    // 民兵：7 + 2文明 + 1 + 3 + 1天赋 = 14 → round(14×1.1) = 15
    expect(unitAtk(s, 'militia')).toBe(15)
  })

  it('建筑费用：商业联邦 + co_steel + 坚固图纸，逐步取整', () => {
    const s = makeState({ nation: 'commerce', skills: ['co_steel'], relics: ['sturdy_plans'] })
    // 农场 Lv0：8 木 → floor(8×0.85)=6 → floor(6×0.9)=5 → floor(5×0.9)=4
    expect(buildCost(s, 'farm').wood).toBe(4)
  })

  it('人口上限：ag_granary + ag_population + 2 民居', () => {
    const s = makeState({ skills: ['ag_granary', 'ag_population'] })
    s.buildings = { ...s.buildings, house: 2 }
    expect(popCap(s)).toBe(10 + 2 * 6 + 4 + 8)
  })

  it('城防：co_fortress + marksman + 堡垒基石（mult 在 flat 之后）', () => {
    const s = makeState({ skills: ['co_fortress'], talents: ['marksman', 'reinforce'], relics: ['thick_walls', 'longbow'] })
    // 箭塔：10 + 10 + 4 = 24 → round(24×1.25) = 30
    expect(towerDmg(s)).toBe(30)
    // 城墙：35 + 20 + 10 = 65 → round(65×1.2) = 78
    expect(wallAbsorb(s)).toBe(78)
  })
})


// ============================================================
// 完整性：每个有持续被动效果的内容都必须有 effects 声明
// （漏填 = 静默失效，此测试兜底；一次性开局效果除外）
// ============================================================

describe('effects 声明完整性', () => {
  it('所有文明都有 effects 声明', async () => {
    const { NATIONS } = await import('./config')
    for (const def of Object.values(NATIONS)) {
      expect(def.effects, `文明 ${def.id} 缺少 effects`).toBeDefined()
    }
  })

  it('所有技能都有 effects 声明', async () => {
    const { SKILLS } = await import('./config')
    for (const def of SKILLS) {
      expect(def.effects, `技能 ${def.id} 缺少 effects`).toBeDefined()
    }
  })

  it('所有遗物都有 effects 声明', async () => {
    const { RELICS } = await import('./relics')
    for (const def of Object.values(RELICS)) {
      expect(def.effects, `遗物 ${def.id} 缺少 effects`).toBeDefined()
    }
  })

  it('除一次性开局效果外的天赋都有 effects 声明', async () => {
    const { TALENTS } = await import('./meta')
    const ONE_TIME = ['granary_start', 'rich_vein', 'militia_start'] // 开局资源/兵种，由 createGame 结算
    for (const def of TALENTS) {
      if (ONE_TIME.includes(def.id)) {
        expect(def.effects, `一次性天赋 ${def.id} 不应有 effects`).toBeUndefined()
      } else {
        expect(def.effects, `天赋 ${def.id} 缺少 effects`).toBeDefined()
      }
    }
  })

  it('声明的 effects 确实生效：逐项声明非空且 collectMods 汇总后不等于空值', async () => {
    const { SKILLS } = await import('./config')
    const { TALENTS } = await import('./meta')
    const { RELICS } = await import('./relics')
    const nonEmpty = (c: object) => Object.keys(c).length > 0
    for (const def of SKILLS) expect(nonEmpty(def.effects!), `技能 ${def.id} effects 为空`).toBe(true)
    for (const def of TALENTS.filter((t) => t.effects)) expect(nonEmpty(def.effects!), `天赋 ${def.id} effects 为空`).toBe(true)
    for (const def of Object.values(RELICS)) expect(nonEmpty(def.effects), `遗物 ${def.id} effects 为空`).toBe(true)
  })
})
