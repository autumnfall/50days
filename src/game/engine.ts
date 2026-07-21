// ============================================================
// 《五十日坚守》游戏引擎 —— 纯逻辑，无 UI
// ============================================================

import {
  BUILDINGS, CONFIG, HONOR_EXCHANGE_BASE, SKILLS, TOWER_DMG, UNITS, WALL_ABSORB_PER,
  getWave, pickRandomEvent, scaleEvent,
  type BuildingId, type GameEvent, type NationId, type ResourceId, type UnitId, type UpgradeId, type WaveInfo,
} from './config'

export type Phase = 'start' | 'playing' | 'battle' | 'victory' | 'defeat'

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
}

// ---------------- 初始化 ----------------

export function createGame(): GameState {
  return {
    phase: 'start',
    nation: null,
    day: 1,
    resources: { food: CONFIG.start.food, wood: CONFIG.start.wood, gold: CONFIG.start.gold },
    villagers: CONFIG.start.villagers,
    assignment: { food: 3, wood: 2, gold: 0 },
    soldiers: { militia: 0, archer: 0, knight: 0 },
    buildings: { farm: 0, lumber: 0, mine: 0, house: 0, barracks: 0, wall: 0, tower: 0 },
    skills: new Set(),
    honor: 0,
    upgrades: { prod: 0, def: 0, army: 0 },
    honorExchange: { food: 0, wood: 0, gold: 0 },
    log: [{ day: 1, text: '你带领族人来到这片山谷，建立营地。坚守 50 天，等待王国援军！', kind: 'info' }],
    battle: null,
    lastIncome: null,
    defeatReason: null,
    pendingEvent: null,
    omen: false,
    wavesFaced: 0,
    lastWaveDay: 2,
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
  return s.soldiers.militia + s.soldiers.archer + s.soldiers.knight
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

/** 建筑有效上限 = 基础 max + 终局升级 */
export function effectiveMax(s: GameState, id: BuildingId): number {
  const base = BUILDINGS[id].max
  if (id === 'farm' || id === 'lumber' || id === 'mine' || id === 'house') return base + s.upgrades.prod
  if (id === 'wall' || id === 'tower') return base + s.upgrades.def
  return base
}

/** 士兵实际攻击（含国家/技能/终局升级加成） */
export function unitAtk(s: GameState, id: UnitId): number {
  let atk = UNITS[id].atk
  if (s.nation === 'military') atk += 2
  if (hasSkill(s, 'mi_drill')) atk += 1
  if (hasSkill(s, 'mi_kingarmy')) atk += 3
  if (hasSkill(s, 'ag_militia') && id === 'militia') atk += 3
  if (hasSkill(s, 'mi_veteran') && id === 'knight') atk += 6
  if (hasSkill(s, 'mi_veteran') && id === 'archer') atk += 3
  // 终局军队增强
  const armyAtk: Record<UnitId, number> = { militia: 1, archer: 2, knight: 3 }
  atk += armyAtk[id] * s.upgrades.army
  return atk
}

export function unitHp(s: GameState, id: UnitId): number {
  let hp = UNITS[id].hp
  if (hasSkill(s, 'mi_armor')) hp += 4
  if (hasSkill(s, 'mi_discipline')) hp += 6
  if (hasSkill(s, 'mi_kingarmy')) hp += 6
  if (hasSkill(s, 'ag_militia') && id === 'militia') hp += 6
  const armyHp: Record<UnitId, number> = { militia: 2, archer: 2, knight: 4 }
  hp += armyHp[id] * s.upgrades.army
  return hp
}

export function towerDmg(s: GameState): number {
  let dmg = TOWER_DMG
  if (hasSkill(s, 'co_engineer')) dmg += 4
  if (hasSkill(s, 'co_steel')) dmg += 6
  if (hasSkill(s, 'co_fortress')) dmg += 10
  dmg += 2 * s.upgrades.def
  return dmg
}

export function wallAbsorb(s: GameState): number {
  let ab = WALL_ABSORB_PER
  if (hasSkill(s, 'co_engineer')) ab += 10
  if (hasSkill(s, 'ag_earthwall')) ab += 15
  if (hasSkill(s, 'co_fortress')) ab += 20
  ab += 7 * s.upgrades.def
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
    s.buildings.tower * towerDmg(s)
  )
}

export function wavePower(w: WaveInfo): number {
  return Math.round(w.count * w.atkEach)
}

/** 每日食物总消耗：村民 2/天，士兵按兵种 3~4/天 */
export function foodUpkeep(s: GameState): number {
  return (
    s.villagers * CONFIG.villagerUpkeep +
    s.soldiers.militia * UNITS.militia.upkeep +
    s.soldiers.archer * UNITS.archer.upkeep +
    s.soldiers.knight * UNITS.knight.upkeep
  )
}

// ---------------- 建筑/训练/招募费用（含国家/技能折扣，每步向下取整） ----------------

export function buildCost(s: GameState, id: BuildingId): Partial<Record<ResourceId, number>> {
  let cost = BUILDINGS[id].cost(s.buildings[id])
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
  let ns: GameState = { ...s, resources: { ...s.resources }, log: [...s.log] }

  // 1. 资源采集（含国家/技能加成）
  const farmBonus = CONFIG.farmBonus * (hasSkill(ns, 'ag_fertility') ? 2 : 1)
  const foodPer = CONFIG.foodGatherBase + ns.buildings.farm * farmBonus
    + (ns.nation === 'agriculture' ? 1 : 0) + (hasSkill(ns, 'ag_irrigate') ? 1 : 0)
  const woodPer = CONFIG.gatherBase + ns.buildings.lumber
  const goldPer = CONFIG.gatherBase + ns.buildings.mine
    + (ns.nation === 'commerce' ? 1 : 0) + (hasSkill(ns, 'co_market') ? 1 : 0)

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
    const order: UnitId[] = ['militia', 'archer', 'knight']
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

  // 6. 随机波次：第 3 天起每天判定，概率 20% 逐日递增
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

  // 7. 胜利判定
  if (newDay > CONFIG.totalDays) {
    return { ...ns, phase: 'victory', log: pushLog(ns, '🎉 王国的援军抵达了！你守住了 50 天！', 'good') }
  }
  return ns
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
  // 村民增减（受住房上限约束）
  if (e.villagers) {
    const target = ns.villagers + e.villagers
    ns.villagers = e.villagers > 0 ? Math.min(popCap(ns) - soldierCount(ns), target) : Math.max(0, target)
    ns.villagers = Math.max(0, ns.villagers)
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
  ;(['knight', 'archer', 'militia'] as UnitId[]).forEach((id) => {
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
  const survivors: Record<UnitId, number> = { militia: 0, archer: 0, knight: 0 }
  units.forEach((u) => survivors[u.id]++)
  ;(['militia', 'archer', 'knight'] as UnitId[]).forEach((id) => {
    const lost = ns.soldiers[id] - survivors[id]
    if (lost > 0) report.soldiersLost[id] = lost
  })

  // 英魂庇护：各兵种复活阵亡数 30%（向下取整）
  if (hasSkill(ns, 'mi_soulguard')) {
    ;(['militia', 'archer', 'knight'] as UnitId[]).forEach((id) => {
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

export function closeBattleReport(s: GameState): GameState {
  if (s.phase !== 'battle') return s
  if (s.day >= CONFIG.totalDays) {
    return { ...s, phase: 'victory', battle: null, log: pushLog(s, '🎉 王国的援军抵达了！你守住了 50 天！', 'good') }
  }
  return { ...s, phase: 'playing', battle: null }
}
