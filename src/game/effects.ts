// ============================================================
// 效果系统统一 —— 所有被动效果（文明/技能/天赋/遗物/终局升级）
// 声明为数据，由 collectMods 单点收集，结算处只读 EffectMods。
// 加新内容 = 加配置数据；漏接效果字段 = 编译错误。
// ============================================================

import type { BaseUnitId, BuildingId, ResourceId } from './config'
import type { GameState } from './engine'

// ---------------- EffectMods：一局内所有被动效果的汇总视图 ----------------

export interface EffectMods {
  // ---- 采集（gatherPerPerson / endTurn / previewTurnIncome）----
  /** 每位村民各资源产出加成（加算） */
  gatherFlat: Record<ResourceId, number>
  /** 采集总产出乘算链（保序，每步 floor）：如 [ag_abundance 1.25, harvest_totem 1.15] */
  gatherMults: Record<ResourceId, number[]>
  /** 农场每级加成（加算）：rich_soil +1 */
  farmBonusFlat: number
  /** 农场加成倍率：ag_fertility ×2 */
  farmBonusMult: number
  /** 每名民兵回合末各资源 +N（militia_economy，0=关闭；不吃百分比加成） */
  militiaIncome: number

  // ---- 单位属性（baseUnitAtk / baseUnitHp）----
  unitAtkFlat: number
  /** 全体攻击乘算（所有加算之后一次性 round）：whetstone ×1.1 */
  unitAtkMult: number
  unitHpFlat: number
  unitAtkByType: Partial<Record<BaseUnitId, number>>
  unitHpByType: Partial<Record<BaseUnitId, number>>

  // ---- 城防（towerDmg / wallAbsorb / effectiveMax）----
  towerDmgFlat: number
  towerDmgMult: number
  /** 每座城墙/箭塔使箭塔伤害 +N（arrow_volley） */
  towerDmgPerDefBuilding: number
  wallAbsorbFlat: number
  wallAbsorbMult: number
  buildingCapFlat: Partial<Record<BuildingId, number>>

  // ---- 费用（保序乘算链，每步 floor，与"每步向下取整"语义逐位一致）----
  buildCostMults: number[]
  trainCostMults: number[]
  recruitCostMults: number[]
  /** 资源兑换荣耀费用乘算：co_goldwater ×0.75 */
  exchangeCostMult: number

  // ---- 经济 ----
  /** 金币利息档位（取最高档，co_goldwater 0.05 覆盖 co_caravan 0.02） */
  interestRateMax: number
  /** 金币利息增量（merchant_charm +0.03，与档位相加） */
  interestRateAdd: number
  /** 战斗缴获乘算链（保序，每步 round） */
  lootMults: number[]
  /** 战斗胜利额外荣耀 */
  honorPerWin: number

  // ---- 人口 / 流浪者 / 饥荒 ----
  popCapFlat: number
  /** 饥荒少饿死 N 人（ag_granary/ag_population） */
  starveFlatReduction: number
  /** 流浪者来投间隔（0=默认 CONFIG.wandererInterval；ag_abundance → 2） */
  wandererInterval: number
  /** 流浪者每次来投额外人数（基础 1 人之上） */
  wandererBonus: number

  // ---- 战斗内数值 ----
  /** 首轮伤害倍率：mi_warhorn 1.4 × war_drum 1.25 */
  firstRoundMult: number
  /** 敌方伤害倍率：mi_discipline ×0.9 */
  enemyDmgMult: number
  /** 战后复活/挽回比例链（各自按原始阵亡数 floor 后相加） */
  reviveRatios: number[]
  /** 城墙战后自动修复比例（ag_earthwall 0.5，0=关闭） */
  wallRepairRatio: number

  // ---- 机制开关（非纯数值，结算内仍需分支，但集中收集、类型兜底）----
  flags: {
    /** mi_bloodlust：每击杀 3 敌全体攻 +1 */
    bloodlust: boolean
    /** ag_allmilitia：村民协防 */
    militiaAll: boolean
    /** co_mercenary：训练只花金币 */
    mercenary: boolean
    /** co_caravan：「远行商队」事件权重 ×2 */
    traderBoost: boolean
    /** 春播秋收：每 10 天农场自动 +1 级 */
    springHarvest: boolean
    /** 营造法式：建筑升级加价幅度减半 */
    halfScaling: boolean
    /** 神圣谷种：饥荒饿死人数减半 */
    sacredGrain: boolean
    /** 战旗：每击退一波 +1 民兵 */
    warBanner: boolean
  }
}

export const EMPTY_MODS: EffectMods = {
  gatherFlat: { food: 0, wood: 0, gold: 0 },
  gatherMults: { food: [], wood: [], gold: [] },
  farmBonusFlat: 0,
  farmBonusMult: 1,
  militiaIncome: 0,
  unitAtkFlat: 0,
  unitAtkMult: 1,
  unitHpFlat: 0,
  unitAtkByType: {},
  unitHpByType: {},
  towerDmgFlat: 0,
  towerDmgMult: 1,
  towerDmgPerDefBuilding: 0,
  wallAbsorbFlat: 0,
  wallAbsorbMult: 1,
  buildingCapFlat: {},
  buildCostMults: [],
  trainCostMults: [],
  recruitCostMults: [],
  exchangeCostMult: 1,
  interestRateMax: 0,
  interestRateAdd: 0,
  lootMults: [],
  honorPerWin: 0,
  popCapFlat: 0,
  starveFlatReduction: 0,
  wandererInterval: 0,
  wandererBonus: 0,
  firstRoundMult: 1,
  enemyDmgMult: 1,
  reviveRatios: [],
  wallRepairRatio: 0,
  flags: {
    bloodlust: false,
    militiaAll: false,
    mercenary: false,
    traderBoost: false,
    springHarvest: false,
    halfScaling: false,
    sacredGrain: false,
    warBanner: false,
  },
}

// ---------------- EffectContrib：效果源的声明片段 ----------------

/** 效果源（技能/天赋/遗物/文明）声明的效果片段，全部为可选 */
export interface EffectContrib {
  gatherFlat?: Partial<Record<ResourceId, number>>
  gatherMults?: Partial<Record<ResourceId, number[]>>
  farmBonusFlat?: number
  farmBonusMult?: number
  militiaIncome?: number
  unitAtkFlat?: number
  unitAtkMult?: number
  unitHpFlat?: number
  unitAtkByType?: Partial<Record<BaseUnitId, number>>
  unitHpByType?: Partial<Record<BaseUnitId, number>>
  towerDmgFlat?: number
  towerDmgMult?: number
  towerDmgPerDefBuilding?: number
  wallAbsorbFlat?: number
  wallAbsorbMult?: number
  buildingCapFlat?: Partial<Record<BuildingId, number>>
  buildCostMults?: number[]
  trainCostMults?: number[]
  recruitCostMults?: number[]
  exchangeCostMult?: number
  interestRateMax?: number
  interestRateAdd?: number
  lootMults?: number[]
  honorPerWin?: number
  popCapFlat?: number
  starveFlatReduction?: number
  wandererInterval?: number
  wandererBonus?: number
  firstRoundMult?: number
  enemyDmgMult?: number
  reviveRatios?: number[]
  wallRepairRatio?: number
  flags?: Partial<EffectMods['flags']>
}

// ---------------- mergeMods：深合并 ----------------

const RES_IDS: ResourceId[] = ['food', 'wood', 'gold']

/**
 * 合并一个效果片段到汇总视图。
 * 语义：flat 相加、单发 mult 相乘、mults 数组保序拼接（调用方决定来源顺序）、
 * interestRateMax 取大、wandererInterval 取最小非零、wallRepairRatio 取大、flags 或。
 */
export function mergeMods(base: EffectMods, c: EffectContrib): EffectMods {
  const out: EffectMods = { ...base, gatherFlat: { ...base.gatherFlat }, gatherMults: { food: [...base.gatherMults.food], wood: [...base.gatherMults.wood], gold: [...base.gatherMults.gold] }, unitAtkByType: { ...base.unitAtkByType }, unitHpByType: { ...base.unitHpByType }, buildingCapFlat: { ...base.buildingCapFlat }, buildCostMults: [...base.buildCostMults], trainCostMults: [...base.trainCostMults], recruitCostMults: [...base.recruitCostMults], lootMults: [...base.lootMults], reviveRatios: [...base.reviveRatios], flags: { ...base.flags } }

  if (c.gatherFlat) for (const r of RES_IDS) out.gatherFlat[r] += c.gatherFlat[r] ?? 0
  if (c.gatherMults) for (const r of RES_IDS) out.gatherMults[r].push(...(c.gatherMults[r] ?? []))
  if (c.farmBonusFlat) out.farmBonusFlat += c.farmBonusFlat
  if (c.farmBonusMult) out.farmBonusMult *= c.farmBonusMult
  if (c.militiaIncome) out.militiaIncome += c.militiaIncome
  if (c.unitAtkFlat) out.unitAtkFlat += c.unitAtkFlat
  if (c.unitAtkMult) out.unitAtkMult *= c.unitAtkMult
  if (c.unitHpFlat) out.unitHpFlat += c.unitHpFlat
  if (c.unitAtkByType) for (const [u, v] of Object.entries(c.unitAtkByType) as [BaseUnitId, number][]) out.unitAtkByType[u] = (out.unitAtkByType[u] ?? 0) + v
  if (c.unitHpByType) for (const [u, v] of Object.entries(c.unitHpByType) as [BaseUnitId, number][]) out.unitHpByType[u] = (out.unitHpByType[u] ?? 0) + v
  if (c.towerDmgFlat) out.towerDmgFlat += c.towerDmgFlat
  if (c.towerDmgMult) out.towerDmgMult *= c.towerDmgMult
  if (c.towerDmgPerDefBuilding) out.towerDmgPerDefBuilding += c.towerDmgPerDefBuilding
  if (c.wallAbsorbFlat) out.wallAbsorbFlat += c.wallAbsorbFlat
  if (c.wallAbsorbMult) out.wallAbsorbMult *= c.wallAbsorbMult
  if (c.buildingCapFlat) for (const [b, v] of Object.entries(c.buildingCapFlat) as [BuildingId, number][]) out.buildingCapFlat[b] = (out.buildingCapFlat[b] ?? 0) + v
  if (c.buildCostMults) out.buildCostMults.push(...c.buildCostMults)
  if (c.trainCostMults) out.trainCostMults.push(...c.trainCostMults)
  if (c.recruitCostMults) out.recruitCostMults.push(...c.recruitCostMults)
  if (c.exchangeCostMult) out.exchangeCostMult *= c.exchangeCostMult
  if (c.interestRateMax) out.interestRateMax = Math.max(out.interestRateMax, c.interestRateMax)
  if (c.interestRateAdd) out.interestRateAdd += c.interestRateAdd
  if (c.lootMults) out.lootMults.push(...c.lootMults)
  if (c.honorPerWin) out.honorPerWin += c.honorPerWin
  if (c.popCapFlat) out.popCapFlat += c.popCapFlat
  if (c.starveFlatReduction) out.starveFlatReduction += c.starveFlatReduction
  if (c.wandererInterval) out.wandererInterval = out.wandererInterval === 0 ? c.wandererInterval : Math.min(out.wandererInterval, c.wandererInterval)
  if (c.wandererBonus) out.wandererBonus += c.wandererBonus
  if (c.firstRoundMult) out.firstRoundMult *= c.firstRoundMult
  if (c.enemyDmgMult) out.enemyDmgMult *= c.enemyDmgMult
  if (c.reviveRatios) out.reviveRatios.push(...c.reviveRatios)
  if (c.wallRepairRatio) out.wallRepairRatio = Math.max(out.wallRepairRatio, c.wallRepairRatio)
  if (c.flags) for (const [k, v] of Object.entries(c.flags) as [keyof EffectMods['flags'], boolean][]) out.flags[k] = out.flags[k] || v
  return out
}

// ---------------- collectMods：单点收集 ----------------

/**
 * 汇总一局内所有被动效果。
 * 来源合并顺序（决定 mults 数组顺序，从而保持"每步取整"的逐位语义）：
 * 文明 → 技能（按声明顺序）→ 天赋 → 遗物 → 终局升级换算。
 *
 * TODO(commit 2)：以下硬编码分支将替换为纯数据 merge（读取各 Def 的 effects 字段）。
 */
export function collectMods(s: GameState): EffectMods {
  let m = EMPTY_MODS
  const hasSkill = (id: string) => s.skills.has(id)
  const hasTalent = (id: string) => s.talents.includes(id)
  const hasRelic = (id: string) => s.run?.relics.includes(id) ?? false

  // ---- 文明（被动部分；开局一次性 bonus 留在 chooseNation）----
  if (s.nation === 'agriculture') m = mergeMods(m, { gatherFlat: { food: 1 }, recruitCostMults: [0.75] })
  if (s.nation === 'military') m = mergeMods(m, { unitAtkFlat: 2, trainCostMults: [0.8] })
  if (s.nation === 'commerce') m = mergeMods(m, { gatherFlat: { gold: 1 }, buildCostMults: [0.85] })

  // ---- 技能 ----
  if (hasSkill('ag_irrigate')) m = mergeMods(m, { gatherFlat: { food: 1 } })
  if (hasSkill('ag_fertility')) m = mergeMods(m, { farmBonusMult: 2 })
  if (hasSkill('ag_abundance')) m = mergeMods(m, { gatherMults: { food: [1.25] }, wandererInterval: 2 })
  if (hasSkill('ag_granary')) m = mergeMods(m, { popCapFlat: 4, starveFlatReduction: 1 })
  if (hasSkill('ag_recruit')) m = mergeMods(m, { recruitCostMults: [0.5], wandererBonus: 1 })
  if (hasSkill('ag_population')) m = mergeMods(m, { popCapFlat: 8, starveFlatReduction: 1 })
  if (hasSkill('ag_militia')) m = mergeMods(m, { unitAtkByType: { militia: 3 }, unitHpByType: { militia: 6 } })
  if (hasSkill('ag_allmilitia')) m = mergeMods(m, { flags: { militiaAll: true } })
  if (hasSkill('ag_earthwall')) m = mergeMods(m, { wallAbsorbFlat: 15, wallRepairRatio: 0.5 })
  if (hasSkill('mi_drill')) m = mergeMods(m, { unitAtkFlat: 1 })
  if (hasSkill('mi_veteran')) m = mergeMods(m, { unitAtkByType: { knight: 6, archer: 3 } })
  if (hasSkill('mi_bloodlust')) m = mergeMods(m, { flags: { bloodlust: true } })
  if (hasSkill('mi_armor')) m = mergeMods(m, { unitHpFlat: 4 })
  if (hasSkill('mi_discipline')) m = mergeMods(m, { unitHpFlat: 6, enemyDmgMult: 0.9 })
  if (hasSkill('mi_soulguard')) m = mergeMods(m, { reviveRatios: [0.3] })
  if (hasSkill('mi_warhorn')) m = mergeMods(m, { firstRoundMult: 1.4 })
  if (hasSkill('mi_honor')) m = mergeMods(m, { honorPerWin: 1, trainCostMults: [0.9] })
  if (hasSkill('mi_kingarmy')) m = mergeMods(m, { unitAtkFlat: 3, unitHpFlat: 6, trainCostMults: [0.8] })
  if (hasSkill('co_tariff')) m = mergeMods(m, { gatherMults: { gold: [1.2] } })
  if (hasSkill('co_caravan')) m = mergeMods(m, { interestRateMax: 0.02, flags: { traderBoost: true } })
  if (hasSkill('co_goldwater')) m = mergeMods(m, { interestRateMax: 0.05, lootMults: [1.25], exchangeCostMult: 0.75 })
  if (hasSkill('co_engineer')) m = mergeMods(m, { towerDmgFlat: 4, wallAbsorbFlat: 10 })
  if (hasSkill('co_steel')) m = mergeMods(m, { towerDmgFlat: 6, buildCostMults: [0.9] })
  if (hasSkill('co_fortress')) m = mergeMods(m, { towerDmgFlat: 10, wallAbsorbFlat: 20 })
  if (hasSkill('co_market')) m = mergeMods(m, { gatherFlat: { gold: 1 } })
  if (hasSkill('co_mercenary')) m = mergeMods(m, { flags: { mercenary: true } })
  // 注意：lootMults 保序 = 当前 engine 的应用顺序（war_economy 1.5 先于 goldwater 1.25 结算）。
  // commit 2 数据化后将按 SKILLS 声明顺序（goldwater 在前），存在同时拥有两个 T3 商业技能时
  // ±1 金币的取整差异，可接受。
  if (hasSkill('co_war_economy')) m = mergeMods(m, { lootMults: [1.5], honorPerWin: 1 })

  // ---- 天赋 ----
  if (hasTalent('farm_cap')) m = mergeMods(m, { buildingCapFlat: { farm: 2 } })
  if (hasTalent('farm_hands')) m = mergeMods(m, { gatherFlat: { food: 1 } })
  if (hasTalent('rich_soil')) m = mergeMods(m, { farmBonusFlat: 1 })
  if (hasTalent('spring_harvest')) m = mergeMods(m, { flags: { springHarvest: true } })
  if (hasTalent('industry_cap')) m = mergeMods(m, { buildingCapFlat: { lumber: 1, mine: 1 } })
  if (hasTalent('lumberjack')) m = mergeMods(m, { gatherFlat: { wood: 1 } })
  if (hasTalent('deep_mine')) m = mergeMods(m, { gatherFlat: { gold: 1 } })
  if (hasTalent('half_scaling')) m = mergeMods(m, { flags: { halfScaling: true } })
  if (hasTalent('house_cap')) m = mergeMods(m, { buildingCapFlat: { house: 1 } })
  if (hasTalent('reinforce')) m = mergeMods(m, { wallAbsorbFlat: 10 })
  if (hasTalent('marksman')) m = mergeMods(m, { towerDmgFlat: 4 })
  if (hasTalent('bastion_cap')) m = mergeMods(m, { buildingCapFlat: { wall: 1, tower: 1 } })
  if (hasTalent('arrow_volley')) m = mergeMods(m, { towerDmgPerDefBuilding: 2 })
  if (hasTalent('drill')) m = mergeMods(m, { unitAtkFlat: 1 })
  if (hasTalent('armor')) m = mergeMods(m, { unitHpFlat: 3 })
  if (hasTalent('militia_economy')) m = mergeMods(m, { militiaIncome: 2 })
  if (hasTalent('warlord')) m = mergeMods(m, { buildingCapFlat: { barracks: 1 } })

  // ---- 遗物 ----
  if (hasRelic('harvest_totem')) m = mergeMods(m, { gatherMults: { food: [1.15] } })
  if (hasRelic('whetstone')) m = mergeMods(m, { unitAtkMult: 1.1 })
  if (hasRelic('sturdy_plans')) m = mergeMods(m, { buildCostMults: [0.9] })
  if (hasRelic('war_banner')) m = mergeMods(m, { flags: { warBanner: true } })
  if (hasRelic('merchant_charm')) m = mergeMods(m, { interestRateAdd: 0.03 })
  if (hasRelic('field_medic')) m = mergeMods(m, { reviveRatios: [0.2] })
  if (hasRelic('thick_walls')) m = mergeMods(m, { wallAbsorbMult: 1.2 })
  if (hasRelic('longbow')) m = mergeMods(m, { towerDmgMult: 1.25 })
  if (hasRelic('golden_touch')) m = mergeMods(m, { lootMults: [1.3] })
  if (hasRelic('pioneer_boots')) m = mergeMods(m, { wandererBonus: 1 })
  if (hasRelic('sacred_grain')) m = mergeMods(m, { flags: { sacredGrain: true } })
  if (hasRelic('war_drum')) m = mergeMods(m, { firstRoundMult: 1.25 })

  // ---- 终局升级换算（局内系统，非内容配置，固定换算）----
  if (s.upgrades.army > 0) {
    m = mergeMods(m, {
      unitAtkByType: { militia: 1 * s.upgrades.army, archer: 2 * s.upgrades.army, knight: 3 * s.upgrades.army },
      unitHpByType: { militia: 2 * s.upgrades.army, archer: 2 * s.upgrades.army, knight: 4 * s.upgrades.army },
    })
  }
  if (s.upgrades.def > 0) m = mergeMods(m, { towerDmgFlat: 2 * s.upgrades.def, wallAbsorbFlat: 7 * s.upgrades.def })

  return m
}
