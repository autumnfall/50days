// ============================================================
// 《五十日坚守》游戏引擎 —— 纯逻辑，无 UI
// ============================================================

import {
  BASE_UNIT_IDS, BUILDINGS, CONFIG, HONOR_EXCHANGE_BASE, SKILLS, TOWER_DMG, UNITS, WALL_ABSORB_PER,
  getWave, pickRandomEvent, scaleEvent,
  type BaseUnitId, type BuildingId, type GameEvent, type NationId, type ResourceId, type UnitId, type UpgradeId, type WaveInfo,
} from './config'
import { DUNGEON_FLOORS, rollModifiers, type DungeonModifier } from './dungeon'

export type Phase = 'start' | 'playing' | 'battle' | 'dungeon_result' | 'victory' | 'defeat'

export interface LogEntry {
  day: number
  text: string
  kind: 'info' | 'good' | 'bad' | 'battle' | 'event' | 'skill'
}

export interface BattleRound {
  round: number
  playerDmg: number
  enemyDmg: number
  enemiesLeft: number
  playerLeft: number // 我方剩余战斗单位数（士兵）
  note?: string
  /** 各兵种本回合造成的伤害（地牢用） */
  playerDmgByType?: Partial<Record<UnitId, number>>
  /** 各兵种本回合击杀数（地牢用） */
  playerKillsByType?: Partial<Record<UnitId, number>>
  /** 各兵种本回合阵亡数（地牢用，英魂庇护前） */
  playerLostByType?: Partial<Record<UnitId, number>>
}

export interface BattleReport {
  wave: WaveInfo
  rounds: BattleRound[]
  won: boolean
  breached: boolean
  soldiersLost: Partial<Record<UnitId, number>>
  soldiersRevived: Partial<Record<UnitId, number>> // 英魂庇护复活
  villagersLost: number
  wallLost: number
  wallRepaired: number // 大地壁垒修复
  towersLost: number
  buildingLost: string | null
  lootGold: number
  honorGained: number
}

export interface Income {
  food: number
  wood: number
  gold: number
  upkeep: number
  starved: number
}

export interface GameState {
  phase: Phase
  nation: NationId | null
  day: number
  resources: Record<ResourceId, number>
  villagers: number
  assignment: Record<ResourceId, number>
  soldiers: Record<UnitId, number>
  buildings: Record<BuildingId, number>
  skills: Set<string>
  honor: number
  /** 终局：无限升级等级 */
  upgrades: Record<UpgradeId, number>
  /** 终局：各资源已兑换荣耀次数 */
  honorExchange: Record<ResourceId, number>
  log: LogEntry[]
  battle: BattleReport | null
  lastIncome: Income | null
  defeatReason: string | null
  /** 待玩家抉择的随机事件（缩放后的副本） */
  pendingEvent: { event: GameEvent } | null
  /** 不祥之兆：下一波敌人增强 */
  omen: boolean
  /** 已击退的波数（下一波 = wavesFaced + 1） */
  wavesFaced: number
  /** 上一波来袭的天数（初始 2，使第 3 天来袭概率为 20%） */
  lastWaveDay: number
  /** 是否已击败终局 Boss */
  defeatedFinalBoss: boolean
  /** 局外天赋：本局激活的天赋 id（开局注入，局内不可更改） */
  talents: string[]
  /** 地牢探险状态 */
  dungeon: {
    highestCleared: number
    dailyAttempted: boolean
    pendingResult: DungeonResult | null
  }
}

// ---------------- 初始化 ----------------

export function createGame(talentIds: string[] = []): GameState {
  const has = (id: string) => talentIds.includes(id)
  const resources: Record<ResourceId, number> = { food: CONFIG.start.food, wood: CONFIG.start.wood, gold: CONFIG.start.gold }
  if (has('granary_start')) resources.food += 20 // 天赋：余粮
  if (has('rich_vein')) { resources.wood += 15; resources.gold += 10 } // 天赋：富矿
  const soldiers: Record<UnitId, number> = { militia: has('militia_start') ? 2 : 0, archer: 0, knight: 0, warlord: 0 }
  const log: GameState['log'] = [{ day: 1, text: '你带领族人来到这片山谷，建立营地。坚守 50 天，等待王国援军！', kind: 'info' }]
  if (talentIds.length > 0) {
    log.push({ day: 1, text: `🌟 ${talentIds.length} 项局外天赋已生效，传承之力护佑着你`, kind: 'skill' })
  }
  return {
    phase: 'start',
    nation: null,
    day: 1,
    resources,
    villagers: CONFIG.start.villagers,
    assignment: { food: 3, wood: 2, gold: 0 },
    soldiers,
    buildings: { farm: 0, lumber: 0, mine: 0, house: 0, barracks: 0, wall: 0, tower: 0 },
    skills: new Set(),
    honor: 0,
    upgrades: { prod: 0, def: 0, army: 0 },
    honorExchange: { food: 0, wood: 0, gold: 0 },
    log,
    battle: null,
    lastIncome: null,
    defeatReason: null,
    pendingEvent: null,
    omen: false,
    wavesFaced: 0,
    lastWaveDay: 2,
    defeatedFinalBoss: false,
    talents: [...talentIds],
    dungeon: { highestCleared: 0, dailyAttempted: false, pendingResult: null },
  }
}

export function chooseNation(state: GameState, nation: NationId): GameState {
  let s: GameState = { ...state, nation, phase: 'playing', resources: { ...state.resources } }
  if (nation === 'agriculture') {
    s.resources.food += 15
    s.log = [...s.log, { day: 1, text: '🌾 丰饶农耕国的族人开垦了沃土，开局食物 +15', kind: 'good' }]
  } else if (nation === 'military') {
    s.buildings = { ...s.buildings, barracks: 1 }
    s.log = [...s.log, { day: 1, text: '⚔️ 铁血军事国自带一座兵营，尚武之风盛行', kind: 'good' }]
  } else if (nation === 'commerce') {
    s.resources.gold += 15
    s.log = [...s.log, { day: 1, text: '🪙 黄金商业联邦带来了丰厚资本，开局金币 +15', kind: 'good' }]
  }
  return s
}

// ---------------- 技能 ----------------

export function hasSkill(s: GameState, id: string): boolean {
  return s.skills.has(id)
}

/** 是否激活了某局外天赋 */
export function hasTalent(s: GameState, id: string): boolean {
  return s.talents.includes(id)
}

/** 是否拥有任意 T3 技能（解锁终局机制） */
export function hasT3(s: GameState): boolean {
  return SKILLS.some((k) => k.tier === 3 && s.skills.has(k.id))
}

export function canUnlockSkill(s: GameState, skillId: string): { ok: boolean; reason?: string } {
  const def = SKILLS.find((k) => k.id === skillId)
  if (!def) return { ok: false, reason: '技能不存在' }
  if (def.nation !== s.nation) return { ok: false, reason: '不属于你的文明' }
  if (s.skills.has(skillId)) return { ok: false, reason: '已解锁' }
  if (s.honor < def.cost) return { ok: false, reason: '荣耀点不足' }
  if (def.requires && !s.skills.has(def.requires)) return { ok: false, reason: '需先解锁前置技能' }
  return { ok: true }
}

export function unlockSkill(s: GameState, skillId: string): GameState {
  const check = canUnlockSkill(s, skillId)
  if (!check.ok) return s
  const def = SKILLS.find((k) => k.id === skillId)!
  const skills = new Set(s.skills)
  skills.add(skillId)
  const ns: GameState = { ...s, skills, honor: s.honor - def.cost }
  return { ...ns, log: pushLog(ns, `✨ 解锁技能【${def.icon} ${def.name}】`, 'skill') }
}

// ---------------- 终局：无限升级 ----------------

/** 升级到下一级的荣耀费用：当前等级 n → 2ⁿ（1→2→4→8→16…） */
export function upgradeCost(s: GameState, id: UpgradeId): number {
  return Math.pow(2, s.upgrades[id])
}

export function canBuyUpgrade(s: GameState, id: UpgradeId): boolean {
  return s.phase === 'playing' && hasT3(s) && s.honor >= upgradeCost(s, id)
}

export function buyUpgrade(s: GameState, id: UpgradeId): GameState {
  if (!canBuyUpgrade(s, id)) return s
  const cost = upgradeCost(s, id)
  const ns: GameState = {
    ...s,
    honor: s.honor - cost,
    upgrades: { ...s.upgrades, [id]: s.upgrades[id] + 1 },
  }
  const names: Record<UpgradeId, string> = { prod: '🏗️ 生产建筑增强', def: '🧱 防御建筑增强', army: '⚔️ 军队增强' }
  return { ...ns, log: pushLog(ns, `🔺 ${names[id]}升到 Lv${ns.upgrades[id]}（-${cost} 荣耀）`, 'skill') }
}

// ---------------- 终局：资源兑换荣耀 ----------------

/** 当前兑换费用：100 × 2^次数，黄金水道 ×0.75 取整 */
export function honorExchangeCost(s: GameState, res: ResourceId): number {
  let cost = HONOR_EXCHANGE_BASE * Math.pow(2, s.honorExchange[res])
  if (hasSkill(s, 'co_goldwater')) cost = Math.floor(cost * 0.75)
  return cost
}

export function canExchangeHonor(s: GameState, res: ResourceId): boolean {
  return s.phase === 'playing' && hasT3(s) && s.resources[res] >= honorExchangeCost(s, res)
}

export function exchangeForHonor(s: GameState, res: ResourceId): GameState {
  if (!canExchangeHonor(s, res)) return s
  const cost = honorExchangeCost(s, res)
  const ns: GameState = {
    ...s,
    resources: { ...s.resources, [res]: s.resources[res] - cost },
    honor: s.honor + 1,
    honorExchange: { ...s.honorExchange, [res]: s.honorExchange[res] + 1 },
  }
  const names: Record<ResourceId, string> = { food: '食物', wood: '木材', gold: '金币' }
  return { ...ns, log: pushLog(ns, `🏅 以 ${cost} ${names[res]}献祭，换取 1 荣耀`, 'skill') }
}

// ---------------- 派生数据 ----------------

export function soldierCount(s: GameState): number {
  return s.soldiers.militia + s.soldiers.archer + s.soldiers.knight + s.soldiers.warlord
}

/** 总人口 = 村民 + 士兵（人人都要住房吃饭）。村民转士兵不增减人口，故训练不查上限。 */
export function population(s: GameState): number {
  return s.villagers + soldierCount(s)
}

export function popCap(s: GameState): number {
  let cap = CONFIG.basePopCap + s.buildings.house * CONFIG.houseCapPer
  if (hasSkill(s, 'ag_granary')) cap += 4
  if (hasSkill(s, 'ag_population')) cap += 8
  return cap
}

export function idleVillagers(s: GameState): number {
  return s.villagers - s.assignment.food - s.assignment.wood - s.assignment.gold
}

/** 建筑有效上限 = 基础 max + 终局升级 + 局外天赋 */
export function effectiveMax(s: GameState, id: BuildingId): number {
  let max = BUILDINGS[id].max
  if (id === 'farm' || id === 'lumber' || id === 'mine' || id === 'house') max += s.upgrades.prod
  if (id === 'wall' || id === 'tower') max += s.upgrades.def
  // ---- 局外天赋 ----
  if (id === 'farm' && hasTalent(s, 'farm_cap')) max += 2
  if ((id === 'lumber' || id === 'mine') && hasTalent(s, 'industry_cap')) max += 1
  if (id === 'house' && hasTalent(s, 'house_cap')) max += 1
  if ((id === 'wall' || id === 'tower') && hasTalent(s, 'bastion_cap')) max += 1
  if (id === 'barracks' && hasTalent(s, 'warlord')) max += 1 // 战神：兵营可升至 Lv4
  return max
}

/** 基础三兵种的实际攻击（含国家/技能/天赋/终局升级加成） */
function baseUnitAtk(s: GameState, id: BaseUnitId): number {
  let atk = UNITS[id].atk
  if (s.nation === 'military') atk += 2
  if (hasSkill(s, 'mi_drill')) atk += 1
  if (hasSkill(s, 'mi_kingarmy')) atk += 3
  if (hasSkill(s, 'ag_militia') && id === 'militia') atk += 3
  if (hasSkill(s, 'mi_veteran') && id === 'knight') atk += 6
  if (hasSkill(s, 'mi_veteran') && id === 'archer') atk += 3
  // 终局军队增强
  const armyAtk: Record<BaseUnitId, number> = { militia: 1, archer: 2, knight: 3 }
  atk += armyAtk[id] * s.upgrades.army
  // 局外天赋：操练
  if (hasTalent(s, 'drill')) atk += 1
  return atk
}

/** 基础三兵种的实际生命 */
function baseUnitHp(s: GameState, id: BaseUnitId): number {
  let hp = UNITS[id].hp
  if (hasSkill(s, 'mi_armor')) hp += 4
  if (hasSkill(s, 'mi_discipline')) hp += 6
  if (hasSkill(s, 'mi_kingarmy')) hp += 6
  if (hasSkill(s, 'ag_militia') && id === 'militia') hp += 6
  const armyHp: Record<BaseUnitId, number> = { militia: 2, archer: 2, knight: 4 }
  hp += armyHp[id] * s.upgrades.army
  // 局外天赋：甲胄
  if (hasTalent(s, 'armor')) hp += 3
  return hp
}

/**
 * 士兵实际攻击。
 * 战神 = 民兵/弓箭手/骑士各 1 名当前生效属性之和（静态加成经快照传导，
 * 不会在战神身上重复结算；战斗内动态增益照常生效）。
 */
export function unitAtk(s: GameState, id: UnitId): number {
  if (id === 'warlord') return BASE_UNIT_IDS.reduce((sum, u) => sum + baseUnitAtk(s, u), 0)
  return baseUnitAtk(s, id)
}

export function unitHp(s: GameState, id: UnitId): number {
  if (id === 'warlord') return BASE_UNIT_IDS.reduce((sum, u) => sum + baseUnitHp(s, u), 0)
  return baseUnitHp(s, id)
}

export function towerDmg(s: GameState): number {
  let dmg = TOWER_DMG
  if (hasSkill(s, 'co_engineer')) dmg += 4
  if (hasSkill(s, 'co_steel')) dmg += 6
  if (hasSkill(s, 'co_fortress')) dmg += 10
  dmg += 2 * s.upgrades.def
  // 局外天赋：射术 + 箭阵（每座防御建筑 +2）
  if (hasTalent(s, 'marksman')) dmg += 4
  if (hasTalent(s, 'arrow_volley')) dmg += 2 * (s.buildings.wall + s.buildings.tower)
  return dmg
}

export function wallAbsorb(s: GameState): number {
  let ab = WALL_ABSORB_PER
  if (hasSkill(s, 'co_engineer')) ab += 10
  if (hasSkill(s, 'ag_earthwall')) ab += 15
  if (hasSkill(s, 'co_fortress')) ab += 20
  ab += 7 * s.upgrades.def
  // 局外天赋：加固
  if (hasTalent(s, 'reinforce')) ab += 10
  return ab
}

/** 某天敌军来袭的概率（第 3 天起 20%，每天 +20%，第 5 天必来） */
export function waveChanceForDay(s: GameState, day: number): number {
  if (day < CONFIG.firstWaveDay) return 0
  return Math.min(1, CONFIG.waveChanceStep * (day - s.lastWaveDay))
}

/** 明天敌军来袭的概率 */
export function waveChanceTomorrow(s: GameState): number {
  return waveChanceForDay(s, s.day + 1)
}

/** 下一波敌人（第 wavesFaced+1 波，不祥之兆增强版） */
export function nextWave(s: GameState): WaveInfo {
  const w = getWave(s.wavesFaced + 1)
  if (s.omen) {
    return { ...w, count: Math.round(w.count * 1.25), hpEach: Math.round(w.hpEach * 1.2) }
  }
  return w
}

export function armyPower(s: GameState): number {
  return (
    s.soldiers.militia * unitAtk(s, 'militia') +
    s.soldiers.archer * unitAtk(s, 'archer') +
    s.soldiers.knight * unitAtk(s, 'knight') +
    s.soldiers.warlord * unitAtk(s, 'warlord') +
    s.buildings.tower * towerDmg(s)
  )
}

export function wavePower(w: WaveInfo): number {
  return Math.round(w.count * w.atkEach)
}

/** 终局 Boss：固定为第 20 波难度 */
export function finalBossWave(): WaveInfo {
  const w = getWave(20)
  return { ...w, wave: 0, name: '终局决战 · ' + w.name, icon: '💀' }
}

/** 每日食物总消耗：村民 2/天，士兵按兵种 3~10/天 */
export function foodUpkeep(s: GameState): number {
  return (
    s.villagers * CONFIG.villagerUpkeep +
    s.soldiers.militia * UNITS.militia.upkeep +
    s.soldiers.archer * UNITS.archer.upkeep +
    s.soldiers.knight * UNITS.knight.upkeep +
    s.soldiers.warlord * UNITS.warlord.upkeep
  )
}

/** 农场每级加成的实际值（沃土天赋 +1，丰收祝福翻倍） */
export function farmBonusPer(s: GameState): number {
  const base = CONFIG.farmBonus + (hasTalent(s, 'rich_soil') ? 1 : 0)
  return base * (hasSkill(s, 'ag_fertility') ? 2 : 1)
}

/** 每位村民的各资源日产出（含建筑/国家/技能/局外天赋加成） */
export function gatherPerPerson(s: GameState): { foodPer: number; woodPer: number; goldPer: number } {
  const foodPer = CONFIG.foodGatherBase + s.buildings.farm * farmBonusPer(s)
    + (s.nation === 'agriculture' ? 1 : 0) + (hasSkill(s, 'ag_irrigate') ? 1 : 0)
    + (hasTalent(s, 'farm_hands') ? 1 : 0)
  const woodPer = CONFIG.gatherBase + s.buildings.lumber
    + (hasTalent(s, 'lumberjack') ? 1 : 0)
  const goldPer = CONFIG.gatherBase + s.buildings.mine
    + (s.nation === 'commerce' ? 1 : 0) + (hasSkill(s, 'co_market') ? 1 : 0)
    + (hasTalent(s, 'deep_mine') ? 1 : 0)
  return { foodPer, woodPer, goldPer }
}

// ---------------- 建筑/训练/招募费用（含国家/技能折扣，每步向下取整） ----------------

export function buildCost(s: GameState, id: BuildingId): Partial<Record<ResourceId, number>> {
  let cost = BUILDINGS[id].cost(s.buildings[id])
  // 局外天赋：营造法式 —— 升级加价幅度减半（基础价不变，向上取整）
  if (hasTalent(s, 'half_scaling')) {
    const base = BUILDINGS[id].cost(0)
    cost = Object.fromEntries(
      (Object.entries(cost) as [ResourceId, number][]).map(([r, v]) => {
        const b = base[r] ?? 0
        return [r, b + Math.ceil((v - b) / 2)]
      }),
    )
  }
  if (s.nation === 'commerce') {
    cost = Object.fromEntries(
      (Object.entries(cost) as [ResourceId, number][]).map(([r, v]) => [r, Math.max(1, Math.floor(v * 0.85))]),
    )
  }
  if (hasSkill(s, 'co_steel')) {
    cost = Object.fromEntries(
      (Object.entries(cost) as [ResourceId, number][]).map(([r, v]) => [r, Math.max(1, Math.floor(v * 0.9))]),
    )
  }
  return cost
}

export function trainCost(s: GameState, id: UnitId): Partial<Record<ResourceId, number>> {
  let cost = { ...UNITS[id].cost }
  if (s.nation === 'military') {
    cost = Object.fromEntries(
      (Object.entries(cost) as [ResourceId, number][]).map(([r, v]) => [r, Math.max(1, Math.floor(v * 0.8))]),
    ) as Partial<Record<ResourceId, number>>
  }
  if (hasSkill(s, 'mi_honor')) {
    cost = Object.fromEntries(
      (Object.entries(cost) as [ResourceId, number][]).map(([r, v]) => [r, Math.max(1, Math.floor(v * 0.9))]),
    ) as Partial<Record<ResourceId, number>>
  }
  if (hasSkill(s, 'mi_kingarmy')) {
    cost = Object.fromEntries(
      (Object.entries(cost) as [ResourceId, number][]).map(([r, v]) => [r, Math.max(1, Math.floor(v * 0.8))]),
    ) as Partial<Record<ResourceId, number>>
  }
  if (hasSkill(s, 'co_mercenary')) {
    // 只花金币，免食物，费用 -15%
    const total = Math.max(1, Math.floor(((cost.gold ?? 0) + (cost.food ?? 0) * 0.5) * 0.85))
    cost = { gold: total }
  }
  return cost
}

export function recruitCost(s: GameState): Partial<Record<ResourceId, number>> {
  let cost = CONFIG.recruitCost.food!
  if (s.nation === 'agriculture') cost = Math.max(1, Math.floor(cost * 0.75))
  if (hasSkill(s, 'ag_recruit')) cost = Math.max(1, Math.floor(cost * 0.5))
  return { food: cost }
}

// ---------------- 行动 ----------------

function pushLog(s: GameState, text: string, kind: LogEntry['kind']): LogEntry[] {
  return [...s.log, { day: s.day, text, kind }].slice(-100)
}

export function assign(s: GameState, res: ResourceId, delta: number): GameState {
  if (s.phase !== 'playing') return s
  const cur = s.assignment[res]
  const idle = idleVillagers(s)
  const next = delta > 0
    ? Math.min(cur + delta, cur + idle)
    : Math.max(0, cur + delta)
  if (next === cur) return s
  return { ...s, assignment: { ...s.assignment, [res]: next } }
}

export function canAfford(s: GameState, cost: Partial<Record<ResourceId, number>>): boolean {
  return (Object.entries(cost) as [ResourceId, number][]).every(([r, v]) => s.resources[r] >= v)
}

export function build(s: GameState, id: BuildingId): GameState {
  if (s.phase !== 'playing') return s
  const def = BUILDINGS[id]
  const level = s.buildings[id]
  if (level >= effectiveMax(s, id)) return s
  const cost = buildCost(s, id)
  if (!canAfford(s, cost)) return s
  const resources = { ...s.resources }
  for (const [r, v] of Object.entries(cost) as [ResourceId, number][]) resources[r] -= v
  const ns = { ...s, resources, buildings: { ...s.buildings, [id]: level + 1 } }
  const label = id === 'barracks' ? `${def.name} 升到 Lv${level + 1}` : `${def.name} 建成（${level + 1}/${effectiveMax(ns, id)}）`
  return { ...ns, log: pushLog(ns, `🔨 ${label}`, 'good') }
}

export function train(s: GameState, id: UnitId): GameState {
  if (s.phase !== 'playing') return s
  const def = UNITS[id]
  if (s.buildings.barracks < def.reqBarracks) return s
  if (s.villagers < 1) return s
  // 战神全局唯一
  if (id === 'warlord' && s.soldiers.warlord >= 1) return s
  // 注意：村民转士兵不改变总人口（1:1 转化），故不检查人口上限
  const cost = trainCost(s, id)
  if (!canAfford(s, cost)) return s
  const resources = { ...s.resources }
  for (const [r, v] of Object.entries(cost) as [ResourceId, number][]) resources[r] -= v
  let assignment = s.assignment
  if (idleVillagers(s) < 1) {
    assignment = fixAssignment({ ...s, villagers: s.villagers - 1 })
  }
  const ns: GameState = {
    ...s,
    resources,
    assignment,
    villagers: s.villagers - 1,
    soldiers: { ...s.soldiers, [id]: s.soldiers[id] + 1 },
  }
  return { ...ns, log: pushLog(ns, `🎖️ 一名村民受训成为${def.name}`, 'good') }
}

export function recruit(s: GameState): GameState {
  if (s.phase !== 'playing') return s
  if (population(s) >= popCap(s)) return s
  const cost = recruitCost(s)
  if (!canAfford(s, cost)) return s
  const resources = { ...s.resources }
  for (const [r, v] of Object.entries(cost) as [ResourceId, number][]) resources[r] -= v
  const ns: GameState = { ...s, resources, villagers: s.villagers + 1 }
  return { ...ns, log: pushLog(ns, '🧑‍🌾 一位流民听闻村庄的繁荣，前来投奔（+1 村民）', 'good') }
}

/** 招募至上限的人数：min(食物可负担人数, 人口上限剩余空间) */
export function recruitMaxCount(s: GameState): number {
  const cost = recruitCost(s).food!
  const affordable = Math.floor(s.resources.food / cost)
  const space = popCap(s) - population(s)
  return Math.max(0, Math.min(affordable, space))
}

export function recruitMax(s: GameState): GameState {
  if (s.phase !== 'playing') return s
  const n = recruitMaxCount(s)
  if (n <= 0) return s
  const cost = recruitCost(s).food!
  const ns: GameState = {
    ...s,
    resources: { ...s.resources, food: s.resources.food - cost * n },
    villagers: s.villagers + n,
  }
  return { ...ns, log: pushLog(ns, `🧑‍🌾 大批流民前来投奔（+${n} 村民，-${cost * n} 食物）`, 'good') }
}

// ---------------- 回合结算 ----------------

export function endTurn(s: GameState): GameState {
  if (s.phase !== 'playing') return s
  let ns: GameState = { ...s, resources: { ...s.resources }, log: [...s.log], dungeon: { ...s.dungeon, dailyAttempted: false, pendingResult: null } }

  // 1. 资源采集（含国家/技能/局外天赋加成）
  const { foodPer, woodPer, goldPer } = gatherPerPerson(ns)

  const income: Income = {
    food: ns.assignment.food * foodPer,
    wood: ns.assignment.wood * woodPer,
    gold: ns.assignment.gold * goldPer,
    upkeep: 0,
    starved: 0,
  }
  // 生生不息：食物采集总产出 +25%
  if (hasSkill(ns, 'ag_abundance')) income.food = Math.floor(income.food * 1.25)
  // 商路关税：金币采集 +20%
  if (hasSkill(ns, 'co_tariff')) income.gold = Math.floor(income.gold * 1.2)
  // 局外天赋：义勇 —— 每名民兵各资源 +2（固定值，不吃任何百分比加成）
  if (hasTalent(ns, 'militia_economy') && ns.soldiers.militia > 0) {
    const militiaBonus = ns.soldiers.militia * 2
    income.food += militiaBonus
    income.wood += militiaBonus
    income.gold += militiaBonus
  }

  ns.resources.food += income.food
  ns.resources.wood += income.wood
  ns.resources.gold += income.gold

  // 四方商队/黄金水道：金币存量利息（收入入账后）
  const interestRate = hasSkill(ns, 'co_goldwater') ? 0.05 : hasSkill(ns, 'co_caravan') ? 0.02 : 0
  if (interestRate > 0 && ns.resources.gold > 0) {
    const interest = Math.floor(ns.resources.gold * interestRate)
    if (interest > 0) {
      ns.resources.gold += interest
      ns = { ...ns, log: pushLog(ns, `💰 商路利息入账：+${interest} 金币（${Math.round(interestRate * 100)}%）`, 'good') }
    }
  }

  // 2. 食物消耗（村民 2/天，士兵按兵种 3~4/天）
  income.upkeep = foodUpkeep(ns)
  ns.resources.food -= income.upkeep
  if (ns.resources.food < 0) {
    // 饥荒：每 starveRatio 点缺口饿死 1 人，优先饿死村民
    let deficit = Math.ceil(-ns.resources.food / CONFIG.starveRatio)
    ns.resources.food = 0
    // 谷仓少饿死 1 人 + 人丁兴旺再少 1 人
    if (hasSkill(ns, 'ag_granary') && deficit > 0) deficit -= 1
    if (hasSkill(ns, 'ag_population') && deficit > 0) deficit -= 1
    let remaining = deficit
    const villagerDeaths = Math.min(ns.villagers, remaining)
    ns.villagers -= villagerDeaths
    remaining -= villagerDeaths
    const order: UnitId[] = ['militia', 'archer', 'knight', 'warlord']
    for (const u of order) {
      const d = Math.min(ns.soldiers[u], remaining)
      ns.soldiers = { ...ns.soldiers, [u]: ns.soldiers[u] - d }
      remaining -= d
    }
    income.starved = deficit - remaining
    ns.assignment = fixAssignment(ns)
    ns = { ...ns, log: pushLog(ns, `💀 饥荒！${income.starved} 人饿死（含 ${villagerDeaths} 名村民）`, 'bad') }
  }
  ns.lastIncome = income

  if (ns.villagers + soldierCount(ns) <= 0) {
    return { ...ns, phase: 'defeat', defeatReason: '所有族人都死于饥荒。', log: pushLog(ns, '☠️ 营地已空无一人……', 'bad') }
  }

  // 3. 天数推进
  const newDay = ns.day + 1
  ns = { ...ns, day: newDay }

  // 4. 随机事件（挂起缩放副本，等待玩家抉择）
  const ev = pickRandomEvent(newDay, Math.random, { traderBoost: hasSkill(ns, 'co_caravan') })
  if (ev) {
    ns = { ...ns, pendingEvent: { event: scaleEvent(ev, newDay) } }
  }

  // 5. 流浪者来投（生生不息 → 每 2 天；招贤纳士 → 每次 +2 人）
  const wanderInterval = hasSkill(ns, 'ag_abundance') ? 2 : CONFIG.wandererInterval
  if (newDay % wanderInterval === 0 && population(ns) < popCap(ns) && ns.resources.food > 0) {
    const count = Math.min(hasSkill(ns, 'ag_recruit') ? 2 : 1, popCap(ns) - population(ns))
    if (count > 0) {
      ns = { ...ns, villagers: ns.villagers + count, log: pushLog(ns, `🚶 流浪者路过村庄，决定留下来（+${count} 村民）`, 'info') }
    }
  }

  // 5b. 局外天赋：春播秋收 —— 每 10 天农场自动 +1 级（免费，可突破建造上限）
  if (hasTalent(ns, 'spring_harvest') && newDay % 10 === 0 && newDay < CONFIG.totalDays) {
    ns = {
      ...ns,
      buildings: { ...ns.buildings, farm: ns.buildings.farm + 1 },
      log: pushLog(ns, `🌟 春播秋收！天时眷顾，农场自动提升 1 级（当前 ${ns.buildings.farm + 1} 级）`, 'skill'),
    }
  }

  // 6. 波次判定
  if (newDay >= CONFIG.totalDays) {
    // 终局 Boss：最后一天必定遭遇，固定第 20 波难度
    const boss = finalBossWave()
    ns = { ...ns, omen: false, log: pushLog(ns, `💀 黑暗大军压境！终局决战开始！`, 'battle') }
    ns = resolveBattle(ns, boss)
    if (ns.phase === 'defeat') return ns
    ns = { ...ns, defeatedFinalBoss: true }
  } else {
    // 随机波次：第 3 天起每天判定，概率 20% 逐日递增
    const chance = waveChanceForDay(ns, newDay)
    if (chance > 0 && Math.random() < chance) {
      const wave = getWave(ns.wavesFaced + 1)
      if (ns.omen) {
        wave.count = Math.round(wave.count * 1.25)
        wave.hpEach = Math.round(wave.hpEach * 1.2)
      }
      ns = {
        ...ns,
        wavesFaced: ns.wavesFaced + 1,
        lastWaveDay: newDay,
        log: pushLog(ns, `📯 敌情突现！第 ${ns.wavesFaced + 1} 波敌军来袭！`, 'battle'),
      }
      ns = resolveBattle(ns, wave)
      ns = { ...ns, omen: false }
      if (ns.phase === 'defeat') return ns
    }
  }

  // 7. 胜利判定（必须击败终局 Boss）
  if (newDay > CONFIG.totalDays && ns.defeatedFinalBoss) {
    return { ...ns, phase: 'victory', log: pushLog(ns, '🎉 黑暗大军被击溃！王国的援军抵达了！你守住了 50 天！', 'good') }
  }
  return ns
}

// ---------------- 收入预览 ----------------

export interface TurnPreview {
  food: number
  wood: number
  gold: number
  detail: {
    foodGather: number
    woodGather: number
    goldGather: number
    interest: number
    upkeep: number
    starved: number
  }
}

export function previewTurnIncome(s: GameState): TurnPreview {
  const { foodPer, woodPer, goldPer } = gatherPerPerson(s)

  let foodGather = s.assignment.food * foodPer
  let woodGather = s.assignment.wood * woodPer
  let goldGather = s.assignment.gold * goldPer
  if (hasSkill(s, 'ag_abundance')) foodGather = Math.floor(foodGather * 1.25)
  if (hasSkill(s, 'co_tariff')) goldGather = Math.floor(goldGather * 1.2)
  // 局外天赋：义勇（固定值，不吃百分比加成）
  if (hasTalent(s, 'militia_economy') && s.soldiers.militia > 0) {
    const militiaBonus = s.soldiers.militia * 2
    foodGather += militiaBonus
    woodGather += militiaBonus
    goldGather += militiaBonus
  }

  const goldAfterGather = s.resources.gold + goldGather
  const interestRate = hasSkill(s, 'co_goldwater') ? 0.05 : hasSkill(s, 'co_caravan') ? 0.02 : 0
  const interest = interestRate > 0 && goldAfterGather > 0 ? Math.floor(goldAfterGather * interestRate) : 0

  const upkeep = foodUpkeep(s)
  const foodAfter = s.resources.food + foodGather - upkeep

  let starved = 0
  if (foodAfter < 0) {
    let deficit = Math.ceil(-foodAfter / CONFIG.starveRatio)
    if (hasSkill(s, 'ag_granary') && deficit > 0) deficit -= 1
    if (hasSkill(s, 'ag_population') && deficit > 0) deficit -= 1
    if (deficit > 0) starved = Math.min(deficit, population(s))
  }

  return {
    food: foodGather - upkeep - starved * CONFIG.starveRatio,
    wood: woodGather,
    gold: goldGather + interest,
    detail: { foodGather, woodGather, goldGather, interest, upkeep, starved },
  }
}

/** 玩家对挂起事件做出抉择 */
export function applyEventChoice(s: GameState, choiceId: string): GameState {
  if (!s.pendingEvent) return s
  const { event } = s.pendingEvent
  const choice = event.choices.find((c) => c.id === choiceId)
  if (!choice) return s
  // 校验门槛
  if (choice.reqResources) {
    for (const [r, v] of Object.entries(choice.reqResources) as [ResourceId, number][]) {
      if (s.resources[r] < v) return s
    }
  }
  if (choice.reqSoldiers && soldierCount(s) < choice.reqSoldiers) return s

  const e = choice.effect
  let ns: GameState = { ...s, resources: { ...s.resources }, soldiers: { ...s.soldiers } }

  // 资源增减（不为负）
  if (e.resources) {
    for (const [r, v] of Object.entries(e.resources) as [ResourceId, number][]) {
      ns.resources[r] = Math.max(0, ns.resources[r] + v)
    }
  }
  // 村民增减（允许超过人口上限，仅招募受限制）
  if (e.villagers) {
    ns.villagers = Math.max(0, ns.villagers + e.villagers)
    ns.assignment = fixAssignment(ns)
  }
  // 士兵增减
  if (e.soldiers) {
    for (const [u, v] of Object.entries(e.soldiers) as [UnitId, number][]) {
      ns.soldiers[u] = Math.max(0, ns.soldiers[u] + v)
    }
  }
  if (e.honor) ns.honor = Math.max(0, ns.honor + e.honor)
  if (e.omen) ns.omen = true

  // 随机建筑损毁（祈祷天晴等）
  let extraNote = ''
  if (e.randomBuildingLoss && Math.random() < e.randomBuildingLoss) {
    const candidates = (Object.keys(ns.buildings) as BuildingId[]).filter((b) => ns.buildings[b] > 0)
    if (candidates.length) {
      const target = candidates[Math.floor(Math.random() * candidates.length)]
      ns = { ...ns, buildings: { ...ns.buildings, [target]: ns.buildings[target] - 1 } }
      extraNote = ` 💥 ${BUILDINGS[target].name} 在风雨中受损 -1 级！`
    }
  }

  ns = { ...ns, pendingEvent: null }
  return {
    ...ns,
    log: pushLog(ns, `${event.icon}【${event.title}】你选择了「${choice.label}」→ ${choice.desc}${extraNote}`, 'event'),
  }
}

function fixAssignment(s: GameState): Record<ResourceId, number> {
  const a = { ...s.assignment }
  let over = a.food + a.wood + a.gold - s.villagers
  for (const r of ['gold', 'wood', 'food'] as ResourceId[]) {
    if (over <= 0) break
    const cut = Math.min(a[r], over)
    a[r] -= cut
    over -= cut
  }
  return a
}

// ---------------- 战斗模拟 ----------------

interface Fighter { hp: number; atk: number }

function resolveBattle(s: GameState, wave: WaveInfo): GameState {
  let ns: GameState = { ...s, log: pushLog(s, `⚔️ 第 ${wave.wave} 波敌人来袭：${wave.count} 只${wave.name}！`, 'battle') }

  const enemies: Fighter[] = Array.from({ length: wave.count }, () => ({ hp: wave.hpEach, atk: wave.atkEach }))
  const units: { id: UnitId; hp: number; atk: number }[] = []
  ;(['warlord', 'knight', 'archer', 'militia'] as UnitId[]).forEach((id) => {
    for (let i = 0; i < ns.soldiers[id]; i++) units.push({ id, hp: unitHp(ns, id), atk: unitAtk(ns, id) })
  })
  let wallHp = ns.buildings.wall * wallAbsorb(ns)
  const towers = ns.buildings.tower
  const tDmg = towerDmg(ns)
  const firstRoundBonus = hasSkill(ns, 'mi_warhorn') ? 1.4 : 1
  const bloodlust = hasSkill(ns, 'mi_bloodlust')
  const militiaAll = hasSkill(ns, 'ag_allmilitia')
  const discipline = hasSkill(ns, 'mi_discipline')

  const report: BattleReport = {
    wave,
    rounds: [],
    won: false,
    breached: false,
    soldiersLost: {},
    soldiersRevived: {},
    villagersLost: 0,
    wallLost: 0,
    wallRepaired: 0,
    towersLost: 0,
    buildingLost: null,
    lootGold: 0,
    honorGained: 0,
  }

  const hasDefenders = units.length > 0 || towers > 0 || wallHp > 0
  let kills = 0
  let bloodlustStacks = 0

  if (hasDefenders) {
    for (let round = 1; round <= 30; round++) {
      if (!enemies.length || !units.length) break
      // 我方伤害 = 士兵 + 箭塔 + 全民皆兵（村民协防）+ 嗜血
      let playerDmg = units.reduce((sum, u) => sum + u.atk, 0) + towers * tDmg + bloodlustStacks
      if (militiaAll) playerDmg += ns.villagers * 2
      playerDmg = Math.round(playerDmg * (0.9 + Math.random() * 0.2) * (round === 1 ? firstRoundBonus : 1))
      let enemyDmg = enemies.reduce((sum, e) => sum + e.atk, 0)
      enemyDmg = Math.round(enemyDmg * (0.9 + Math.random() * 0.2) * (discipline ? 0.9 : 1))

      // 我方伤害 → 击杀敌人
      let dmg = playerDmg
      const before = enemies.length
      while (dmg > 0 && enemies.length) {
        const idx = Math.floor(Math.random() * enemies.length)
        const e = enemies[idx]
        const dealt = Math.min(dmg, e.hp)
        e.hp -= dealt
        dmg -= dealt
        if (e.hp <= 0) enemies.splice(idx, 1)
      }
      const roundKills = before - enemies.length
      kills += roundKills
      if (bloodlust) {
        const newStacks = Math.floor(kills / 3)
        if (newStacks > bloodlustStacks) bloodlustStacks = newStacks
      }

      // 敌方伤害 → 城墙 → 士兵
      let note: string | undefined
      dmg = enemyDmg
      if (wallHp > 0 && dmg > 0) {
        const absorbed = Math.min(wallHp, dmg)
        wallHp -= absorbed
        dmg -= absorbed
        if (wallHp <= 0) note = '🧱 城墙被摧毁！'
      }
      while (dmg > 0 && units.length) {
        const idx = Math.floor(Math.random() * units.length)
        const u = units[idx]
        const dealt = Math.min(dmg, u.hp)
        u.hp -= dealt
        dmg -= dealt
        if (u.hp <= 0) units.splice(idx, 1)
      }

      report.rounds.push({
        round,
        playerDmg,
        enemyDmg,
        enemiesLeft: enemies.length,
        playerLeft: units.length,
        note: note ?? (bloodlust && roundKills > 0 && bloodlustStacks > 0 ? `🔥 嗜血 +${bloodlustStacks}` : undefined),
      })
    }
  }

  // 结算士兵损失
  const survivors: Record<UnitId, number> = { militia: 0, archer: 0, knight: 0, warlord: 0 }
  units.forEach((u) => survivors[u.id]++)
  ;(['militia', 'archer', 'knight', 'warlord'] as UnitId[]).forEach((id) => {
    const lost = ns.soldiers[id] - survivors[id]
    if (lost > 0) report.soldiersLost[id] = lost
  })

  // 英魂庇护：各兵种复活阵亡数 30%（向下取整）
  if (hasSkill(ns, 'mi_soulguard')) {
    ;(['militia', 'archer', 'knight', 'warlord'] as UnitId[]).forEach((id) => {
      const lost = report.soldiersLost[id] ?? 0
      const revived = Math.floor(lost * 0.3)
      if (revived > 0) {
        survivors[id] += revived
        report.soldiersRevived[id] = revived
      }
    })
  }
  ns = { ...ns, soldiers: survivors }

  // 城墙损失（大地壁垒：战后自动修复一半，损失向上取整）
  if (wallHp <= 0 && ns.buildings.wall > 0) {
    const original = ns.buildings.wall
    let lost = original
    if (hasSkill(ns, 'ag_earthwall')) {
      const repaired = Math.floor(original / 2)
      lost = original - repaired // 如 5 全毁 → 实际损失 3，修复 2
      report.wallRepaired = repaired
    }
    report.wallLost = lost
    ns = { ...ns, buildings: { ...ns.buildings, wall: original - lost } }
  }

  report.won = enemies.length === 0
  report.breached = enemies.length > 0

  if (report.won) {
    let loot = wave.lootGold
    let honor = 1 + Math.floor(wave.wave / 3)
    if (hasSkill(ns, 'mi_honor')) honor += 1
    if (hasSkill(ns, 'co_war_economy')) {
      loot = Math.round(loot * 1.5)
      honor += 1
    }
    if (hasSkill(ns, 'co_goldwater')) loot = Math.round(loot * 1.25)
    report.lootGold = loot
    report.honorGained = honor
    ns = {
      ...ns,
      resources: { ...ns.resources, gold: ns.resources.gold + loot },
      honor: ns.honor + honor,
    }
    ns = { ...ns, log: pushLog(ns, `🏆 击退了${wave.name}！缴获 ${loot} 金币、${honor} 荣耀`, 'good') }
  } else {
    // 被攻破：残敌劫掠村庄
    const raiders = enemies.length
    const villagersLost = Math.min(ns.villagers, Math.ceil(raiders * 0.6))
    report.villagersLost = villagersLost
    const newVillagers = ns.villagers - villagersLost
    ns = { ...ns, villagers: newVillagers, assignment: fixAssignment({ ...ns, villagers: newVillagers }) }

    // 拆毁一座建筑
    const candidates = (Object.keys(ns.buildings) as BuildingId[]).filter((b) => ns.buildings[b] > 0)
    if (candidates.length) {
      const target = candidates[Math.floor(Math.random() * candidates.length)]
      ns = { ...ns, buildings: { ...ns.buildings, [target]: ns.buildings[target] - 1 } }
      report.buildingLost = `${BUILDINGS[target].icon} ${BUILDINGS[target].name}`
    }
    // 箭塔损失
    if (ns.buildings.tower > 0) {
      const towersLost = Math.min(ns.buildings.tower, Math.ceil(raiders * 0.2))
      ns = { ...ns, buildings: { ...ns.buildings, tower: ns.buildings.tower - towersLost } }
      report.towersLost = towersLost
    }
    ns = { ...ns, log: pushLog(ns, `🔥 防线被突破！${raiders} 只敌人劫掠了村庄，${villagersLost} 名村民遇害`, 'bad') }
  }

  if (ns.villagers + soldierCount(ns) <= 0) {
    return {
      ...ns,
      phase: 'defeat',
      defeatReason: `第 ${wave.wave} 波${wave.name}血洗了村庄，无人生还。`,
      battle: report,
      log: pushLog(ns, '☠️ 营地化为废墟……', 'bad'),
    }
  }

  return { ...ns, battle: report, phase: 'battle' }
}

// ---------------- 地牢 ----------------

export interface DungeonResult {
  floor: number
  wave: WaveInfo
  modifiers: DungeonModifier[]
  rounds: BattleRound[]
  won: boolean
  soldiersLost: Partial<Record<UnitId, number>>
  soldiersRevived: Partial<Record<UnitId, number>>
  honorGained: number
}

function resolveDungeonBattle(s: GameState, floor: number): { state: GameState; result: DungeonResult } {
  const floorDef = DUNGEON_FLOORS[floor - 1]
  const wave = getWave(floorDef.wave)
  const modifiers = rollModifiers(floor)

  let enemyCount = wave.count
  let enemyHp = wave.hpEach
  let enemyAtk = wave.atkEach

  const modIds = modifiers.map((m) => m.id)
  if (modIds.includes('thick_skin')) enemyHp = Math.round(enemyHp * 1.3)
  if (modIds.includes('berserk')) enemyAtk = Math.round(enemyAtk * 1.25 * 10) / 10
  if (modIds.includes('swarm')) enemyCount = Math.round(enemyCount * 1.4)

  const enemies: { hp: number; maxHp: number; atk: number }[] = Array.from(
    { length: enemyCount },
    () => ({ hp: enemyHp, maxHp: enemyHp, atk: enemyAtk }),
  )

  const playerDebuff = modifiers.find((m) => m.type === 'player_debuff')
  let atkMult = 1
  let hpMult = 1
  if (playerDebuff?.id === 'weakened') atkMult = 0.8
  if (playerDebuff?.id === 'fragile') hpMult = 0.75

  const units: { id: UnitId; hp: number; maxHp: number; atk: number }[] = []
  ;(['warlord', 'knight', 'archer', 'militia'] as UnitId[]).forEach((id) => {
    for (let i = 0; i < s.soldiers[id]; i++) {
      units.push({
        id,
        hp: Math.round(unitHp(s, id) * hpMult),
        maxHp: Math.round(unitHp(s, id) * hpMult),
        atk: Math.round(unitAtk(s, id) * atkMult),
      })
    }
  })

  const firstRoundBonus = hasSkill(s, 'mi_warhorn') ? 1.4 : 1
  const bloodlust = hasSkill(s, 'mi_bloodlust')
  const militiaAll = hasSkill(s, 'ag_allmilitia')
  const discipline = hasSkill(s, 'mi_discipline')
  const soulguard = hasSkill(s, 'mi_soulguard')
  const hasThorns = modIds.includes('thorns')
  const hasFrenzy = modIds.includes('frenzy')
  const hasChaos = modIds.includes('chaos')

  const report: DungeonResult = {
    floor,
    wave: { ...wave, count: enemyCount, hpEach: enemyHp, atkEach: enemyAtk },
    modifiers,
    rounds: [],
    won: false,
    soldiersLost: {},
    soldiersRevived: {},
    honorGained: 0,
  }

  let kills = 0
  let bloodlustStacks = 0

  if (units.length > 0) {
    for (let round = 1; round <= 30; round++) {
      if (!enemies.length || !units.length) break

      // ---- 我方各兵种伤害统计 ----
      const unitDmgByType: Partial<Record<UnitId, number>> = {}
      for (const u of units) unitDmgByType[u.id] = (unitDmgByType[u.id] ?? 0) + u.atk
      if (militiaAll) unitDmgByType.militia = (unitDmgByType.militia ?? 0) + s.villagers * 2
      let playerDmg = Object.values(unitDmgByType).reduce((a, b) => a + b!, 0) + bloodlustStacks
      const rngMult = 0.9 + Math.random() * 0.2
      playerDmg = Math.round(playerDmg * rngMult)
      if (round === 1) playerDmg = Math.round(playerDmg * firstRoundBonus)
      if (hasChaos && round === 1) playerDmg = Math.round(playerDmg * 0.5)
      // 按比例缩放各兵种伤害
      const rawTotal = Object.values(unitDmgByType).reduce((a, b) => a + b!, 0)
      if (rawTotal > 0) {
        const scale = (playerDmg - bloodlustStacks) / rawTotal
        for (const k of Object.keys(unitDmgByType) as UnitId[]) unitDmgByType[k] = Math.round(unitDmgByType[k]! * scale)
      }

      // ---- 击杀敌人 ----
      const unitKillsByType: Partial<Record<UnitId, number>> = {}
      let dmg = playerDmg
      while (dmg > 0 && enemies.length) {
        const idx = Math.floor(Math.random() * enemies.length)
        const e = enemies[idx]
        const dealt = Math.min(dmg, e.hp)
        e.hp -= dealt
        dmg -= dealt
        if (e.hp <= 0) {
          enemies.splice(idx, 1)
          // 击杀归属：按剩余伤害贡献概率分配
          const contributors = (Object.keys(unitDmgByType) as UnitId[]).filter((k) => (unitDmgByType[k] ?? 0) > 0)
          if (contributors.length > 0) {
            const totalContrib = contributors.reduce((a, k) => a + unitDmgByType[k]!, 0)
            let roll = Math.random() * totalContrib
            for (const k of contributors) {
              roll -= unitDmgByType[k]!
              if (roll <= 0) { unitKillsByType[k] = (unitKillsByType[k] ?? 0) + 1; break }
            }
          }
        }
      }
      const roundKills = Object.values(unitKillsByType).reduce((a, b) => a + b!, 0)
      kills += roundKills
      if (bloodlust) {
        const newStacks = Math.floor(kills / 3)
        if (newStacks > bloodlustStacks) bloodlustStacks = newStacks
      }

      // ---- 荆棘反伤 ----
      let thornNote: string | undefined
      if (hasThorns) {
        const thorn = Math.round(playerDmg * 0.15)
        let thornDmg = thorn
        while (thornDmg > 0 && units.length) {
          const idx = Math.floor(Math.random() * units.length)
          const u = units[idx]
          const dealt = Math.min(thornDmg, u.hp)
          u.hp -= dealt
          thornDmg -= dealt
          if (u.hp <= 0) { units.splice(idx, 1); thornNote = '🌿 荆棘反伤！' }
        }
      }

      // ---- 敌方伤害 ----
      let enemyFrenzyMult = 1
      if (hasFrenzy) enemyFrenzyMult = 1 + kills * 0.05
      let enemyDmg = enemies.reduce((sum, e) => sum + e.atk, 0) * enemyFrenzyMult
      enemyDmg = Math.round(enemyDmg * (0.9 + Math.random() * 0.2) * (discipline ? 0.9 : 1))

      // ---- 我方伤亡统计（英魂庇护前） ----
      const beforeUnits = units.map((u) => ({ ...u }))
      dmg = enemyDmg
      while (dmg > 0 && units.length) {
        const idx = Math.floor(Math.random() * units.length)
        const u = units[idx]
        const dealt = Math.min(dmg, u.hp)
        u.hp -= dealt
        dmg -= dealt
        if (u.hp <= 0) units.splice(idx, 1)
      }
      const playerLostByType: Partial<Record<UnitId, number>> = {}
      const beforeCounts: Record<string, number> = {}
      for (const u of beforeUnits) beforeCounts[u.id] = (beforeCounts[u.id] ?? 0) + 1
      const afterCounts: Record<string, number> = {}
      for (const u of units) afterCounts[u.id] = (afterCounts[u.id] ?? 0) + 1
      for (const id of ['militia', 'archer', 'knight', 'warlord'] as UnitId[]) {
        const lost = (beforeCounts[id] ?? 0) - (afterCounts[id] ?? 0)
        if (lost > 0) playerLostByType[id] = lost
      }

      report.rounds.push({
        round,
        playerDmg,
        enemyDmg: Math.round(enemyDmg),
        enemiesLeft: enemies.length,
        playerLeft: units.length,
        note: thornNote ?? (bloodlust && roundKills > 0 && bloodlustStacks > 0 ? `🔥 嗜血 +${bloodlustStacks}` : undefined),
        playerDmgByType: unitDmgByType,
        playerKillsByType: unitKillsByType,
        playerLostByType,
      })
    }
  }

  const survivors: Record<UnitId, number> = { militia: 0, archer: 0, knight: 0, warlord: 0 }
  units.forEach((u) => survivors[u.id]++)
  ;(['militia', 'archer', 'knight', 'warlord'] as UnitId[]).forEach((id) => {
    const lost = s.soldiers[id] - survivors[id]
    if (lost > 0) report.soldiersLost[id] = lost
  })

  if (soulguard) {
    ;(['militia', 'archer', 'knight', 'warlord'] as UnitId[]).forEach((id) => {
      const lost = report.soldiersLost[id] ?? 0
      const revived = Math.floor(lost * 0.3)
      if (revived > 0) {
        survivors[id] += revived
        report.soldiersRevived[id] = revived
      }
    })
  }

  report.won = enemies.length === 0

  let ns: GameState = { ...s, soldiers: survivors }

  if (report.won) {
    let honor = floorDef.honor
    if (hasSkill(ns, 'mi_honor')) honor += 1
    if (hasSkill(ns, 'co_war_economy')) honor += 1
    report.honorGained = honor
    ns = {
      ...ns,
      honor: ns.honor + honor,
      dungeon: { ...ns.dungeon, highestCleared: Math.max(ns.dungeon.highestCleared, floor), dailyAttempted: true },
      log: [...ns.log, { day: ns.day, text: `🏆 地牢第${floor}层通关！获得 ${honor} 荣耀`, kind: 'good' }],
    }
  } else {
    ns = {
      ...ns,
      dungeon: { ...ns.dungeon, dailyAttempted: true },
      log: [...ns.log, { day: ns.day, text: `💀 地牢第${floor}层挑战失败，部队撤退`, kind: 'bad' }],
    }
  }

  return { state: ns, result: report }
}

export function enterDungeon(s: GameState, floor: number): GameState {
  if (s.phase !== 'playing') return s
  if (!s.dungeon || s.dungeon.dailyAttempted) return s
  if (floor < 1 || floor > 10) return s
  if (floor > (s.dungeon.highestCleared ?? 0) + 1) return s
  const totalSoldiers = soldierCount(s)
  if (totalSoldiers <= 0) return s

  try {
    const { state, result } = resolveDungeonBattle(s, floor)
    return { ...state, phase: 'dungeon_result', dungeon: { ...state.dungeon, pendingResult: result } }
  } catch (e) {
    console.error('地牢战斗错误:', e)
    return { ...s, log: [...s.log, { day: s.day, text: `⚠️ 地牢异常：${e instanceof Error ? e.message : '未知错误'}`, kind: 'bad' as const }] }
  }
}

export function closeDungeonResult(s: GameState): GameState {
  if (s.phase !== 'dungeon_result') return s
  return { ...s, phase: 'playing', dungeon: { ...s.dungeon, pendingResult: null } }
}

export function closeBattleReport(s: GameState): GameState {
  if (s.phase !== 'battle') return s
  if (s.defeatedFinalBoss) {
    return { ...s, phase: 'victory', battle: null, log: pushLog(s, '🎉 黑暗大军被击溃！王国的援军抵达了！你守住了 50 天！', 'good') }
  }
  return { ...s, phase: 'playing', battle: null }
}
