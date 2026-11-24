// ============================================================
// 局外 meta 进度 —— 传承点 / 天赋树 / 生涯记录（localStorage 持久化）
// ============================================================

import type { GameState } from './engine'
import type { EffectContrib } from './effects'

// ---------------- 天赋定义 ----------------

export type TalentBranch = 'farm' | 'industry' | 'defense' | 'military'

export interface TalentDef {
  id: string
  branch: TalentBranch
  tier: 1 | 2 | 3 | 4 | 5
  name: string
  icon: string
  desc: string
  cost: number
  requires?: string // 支链内链式前置
  /** true = 机制类（每条支线最后一层），仅用于 UI 标记 */
  mechanic?: boolean
  /** 被动效果声明（一次性开局效果不在此处，见 engine.createGame） */
  effects?: EffectContrib
}

export const TALENT_BRANCH_INFO: Record<TalentBranch, { name: string; icon: string }> = {
  farm: { name: '农耕', icon: '🌾' },
  industry: { name: '工业', icon: '🪓' },
  defense: { name: '城防', icon: '🧱' },
  military: { name: '军备', icon: '⚔️' },
}

export const TALENT_BRANCH_ORDER: TalentBranch[] = ['farm', 'industry', 'defense', 'military']

export const TALENTS: TalentDef[] = [
  // ---- 🌾 农耕线 ----
  { id: 'farm_cap', branch: 'farm', tier: 1, name: '开垦', icon: '🚜', cost: 2,
    desc: '农场建造上限 +2',
    effects: { buildingCapFlat: { farm: 2 } } },
  { id: 'farm_hands', branch: 'farm', tier: 2, name: '精耕', icon: '🌱', cost: 3, requires: 'farm_cap',
    desc: '每位务农村民食物产出 +1',
    effects: { gatherFlat: { food: 1 } } },
  { id: 'granary_start', branch: 'farm', tier: 3, name: '余粮', icon: '🛖', cost: 4, requires: 'farm_hands',
    desc: '开局食物 +20' },
  { id: 'rich_soil', branch: 'farm', tier: 4, name: '沃土', icon: '🌽', cost: 5, requires: 'granary_start',
    desc: '农场每级加成 +1（+2 → +3）',
    effects: { farmBonusFlat: 1 } },
  { id: 'spring_harvest', branch: 'farm', tier: 5, name: '春播秋收', icon: '🌟', cost: 6, requires: 'rich_soil', mechanic: true,
    desc: '每 10 天（第 10/20/30/40 天）农场自动提升 1 级，不消耗资源，可突破建造上限',
    effects: { flags: { springHarvest: true } } },

  // ---- 🪓 工业线 ----
  { id: 'industry_cap', branch: 'industry', tier: 1, name: '扩建', icon: '🏗️', cost: 2,
    desc: '伐木场上限 +1，矿场上限 +1',
    effects: { buildingCapFlat: { lumber: 1, mine: 1 } } },
  { id: 'lumberjack', branch: 'industry', tier: 2, name: '匠作', icon: '🪚', cost: 3, requires: 'industry_cap',
    desc: '每位伐木村民木材产出 +1',
    effects: { gatherFlat: { wood: 1 } } },
  { id: 'rich_vein', branch: 'industry', tier: 3, name: '富矿', icon: '⛏️', cost: 4, requires: 'lumberjack',
    desc: '开局木材 +15、金币 +10' },
  { id: 'deep_mine', branch: 'industry', tier: 4, name: '深矿', icon: '💎', cost: 5, requires: 'rich_vein',
    desc: '每位采矿村民金币产出 +1',
    effects: { gatherFlat: { gold: 1 } } },
  { id: 'half_scaling', branch: 'industry', tier: 5, name: '营造法式', icon: '📐', cost: 6, requires: 'deep_mine', mechanic: true,
    desc: '建筑升级的加价幅度减半（向上取整），越升越贵的压力大幅缓解',
    effects: { flags: { halfScaling: true } } },

  // ---- 🧱 城防线 ----
  { id: 'house_cap', branch: 'defense', tier: 1, name: '民居扩建', icon: '🏠', cost: 2,
    desc: '民居建造上限 +1（人口上限 +6）',
    effects: { buildingCapFlat: { house: 1 } } },
  { id: 'reinforce', branch: 'defense', tier: 2, name: '加固', icon: '🔩', cost: 3, requires: 'house_cap',
    desc: '城墙每级吸收 +10（35 → 45）',
    effects: { wallAbsorbFlat: 10 } },
  { id: 'marksman', branch: 'defense', tier: 3, name: '射术', icon: '🎯', cost: 4, requires: 'reinforce',
    desc: '箭塔伤害 +4（10 → 14）',
    effects: { towerDmgFlat: 4 } },
  { id: 'bastion_cap', branch: 'defense', tier: 4, name: '壁垒扩建', icon: '🏰', cost: 5, requires: 'marksman',
    desc: '城墙上限 +1，箭塔上限 +1',
    effects: { buildingCapFlat: { wall: 1, tower: 1 } } },
  { id: 'arrow_volley', branch: 'defense', tier: 5, name: '箭阵', icon: '🏹', cost: 6, requires: 'bastion_cap', mechanic: true,
    desc: '每座已建造的城墙或箭塔，使所有箭塔伤害 +2',
    effects: { towerDmgPerDefBuilding: 2 } },

  // ---- ⚔️ 军备线 ----
  { id: 'militia_start', branch: 'military', tier: 1, name: '募兵', icon: '🛡️', cost: 2,
    desc: '开局即有 2 名民兵' },
  { id: 'drill', branch: 'military', tier: 2, name: '操练', icon: '🥁', cost: 3, requires: 'militia_start',
    desc: '全体士兵攻击 +1',
    effects: { unitAtkFlat: 1 } },
  { id: 'armor', branch: 'military', tier: 3, name: '甲胄', icon: '🪖', cost: 4, requires: 'drill',
    desc: '全体士兵生命 +3',
    effects: { unitHpFlat: 3 } },
  { id: 'militia_economy', branch: 'military', tier: 4, name: '义勇', icon: '🌿', cost: 5, requires: 'armor',
    desc: '回合结束时，每有 1 名民兵，食物/木材/金币各 +2（不吃任何加成）',
    effects: { militiaIncome: 2 } },
  { id: 'warlord', branch: 'military', tier: 5, name: '战神', icon: '🦾', cost: 6, requires: 'militia_economy', mechanic: true,
    desc: '兵营可升至 Lv4，解锁终极兵种「战神」（全局唯一，100 食物 + 100 金币，维护 10 食物）：属性 = 民兵/弓箭手/骑士各 1 名当前生效属性之和',
    effects: { buildingCapFlat: { barracks: 1 } } },
]

export function getTalent(id: string): TalentDef | undefined {
  return TALENTS.find((t) => t.id === id)
}

// ---------------- 规则常量 ----------------

/** 传承点总上限（通关 5 局点满） */
export const TALENT_POINT_CAP = 30
/** 通关胜利获得的传承点 */
export const TALENT_POINTS_VICTORY = 6
/** 败北保底：每坚守 15 天 +1 点，最多 +3 */
export const TALENT_POINTS_DEFEAT_PER_DAYS = 15
export const TALENT_POINTS_DEFEAT_MAX = 3
/** 肉鸽模式：每坚守 10 天 +1 点，每击退 8 波 +1 点，最多 +8 */
export const ROGUE_POINTS_PER_DAYS = 10
export const ROGUE_POINTS_PER_WAVES = 8
export const ROGUE_POINTS_MAX = 8

/** 整棵天赋树的总花费（80，远大于 30 点上限 → 不可能点完全部天赋的一半） */
export const TALENT_TREE_TOTAL_COST = TALENTS.reduce((sum, t) => sum + t.cost, 0)

// ---------------- MetaState 持久化 ----------------

export interface MetaState {
  settledGameIds: string[]
  /** 已获得的传承点（可自由分配/洗点，上限 TALENT_POINT_CAP） */
  earned: number
  /** 当前激活的天赋 id 配点 */
  talents: string[]
  /** 生涯记录 */
  runs: number
  victories: number
  bestDay: number
  /** 肉鸽模式「无尽远征」生涯记录 */
  rogue: { runs: number; bestDay: number; bestWave: number }
}

const META_KEY = 'fiftyDays_meta'

export function defaultMeta(): MetaState {
  return { settledGameIds: [], earned: 0, talents: [], runs: 0, victories: 0, bestDay: 0, rogue: { runs: 0, bestDay: 0, bestWave: 0 } }
}

/** 存储抽象：浏览器用 localStorage，测试/无 DOM 环境降级为内存 */
const memoryStore = new Map<string, string>()
function getStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof localStorage !== 'undefined') return localStorage
  return {
    getItem: (k) => memoryStore.get(k) ?? null,
    setItem: (k, v) => { memoryStore.set(k, v) },
    removeItem: (k) => { memoryStore.delete(k) },
  }
}

export function loadMeta(): MetaState {
  try {
    const raw = getStorage().getItem(META_KEY)
    if (!raw) return defaultMeta()
    const parsed = JSON.parse(raw)
    const meta = { ...defaultMeta(), ...parsed }
    // 兼容旧档：肉鸽生涯记录
    meta.rogue = { ...defaultMeta().rogue, ...(parsed.rogue ?? {}) }
    meta.settledGameIds = Array.isArray(meta.settledGameIds) ? meta.settledGameIds.filter((id: unknown) => typeof id === 'string') : []
    // 过滤已删除/未知的天赋 id，并重新校验合法性
    meta.talents = sanitizeTalents(meta.talents, meta.earned)
    return meta
  } catch {
    return defaultMeta()
  }
}

export function saveMeta(meta: MetaState): boolean {
  try {
    getStorage().setItem(META_KEY, JSON.stringify(meta))
    return true
  } catch {
    return false
  }
}

// ---------------- 配点校验 ----------------

/** 一组配点的总花费 */
export function talentsCost(talentIds: string[]): number {
  return talentIds.reduce((sum, id) => sum + (getTalent(id)?.cost ?? 0), 0)
}

/** 是否可在预算内激活某天资（链式前置 + 点数预算） */
export function canActivateTalent(talentIds: string[], id: string, earned: number): { ok: boolean; reason?: string } {
  const def = getTalent(id)
  if (!def) return { ok: false, reason: '天赋不存在' }
  if (talentIds.includes(id)) return { ok: false, reason: '已激活' }
  if (def.requires && !talentIds.includes(def.requires)) return { ok: false, reason: '需先激活前置天赋' }
  if (talentsCost(talentIds) + def.cost > earned) return { ok: false, reason: '传承点不足' }
  return { ok: true }
}

/** 取消激活：级联移除依赖它的后续天赋 */
export function deactivateTalent(talentIds: string[], id: string): string[] {
  let result = talentIds.filter((t) => t !== id)
  // 反复移除前置不再满足的天赋（链式级联）
  let changed = true
  while (changed) {
    changed = false
    for (const t of result) {
      const def = getTalent(t)
      if (def?.requires && !result.includes(def.requires)) {
        result = result.filter((x) => x !== t)
        changed = true
      }
    }
  }
  return result
}

/** 清洗持久化的配点：去未知 id、按天赋树顺序重排、级联校验前置与预算 */
export function sanitizeTalents(talentIds: string[], earned: number): string[] {
  const result: string[] = []
  for (const def of TALENTS) {
    if (!talentIds.includes(def.id)) continue
    if (canActivateTalent(result, def.id, earned).ok) result.push(def.id)
  }
  return result
}

// ---------------- 局结束结算 ----------------

export interface SettleResult {
  meta: MetaState
  /** 本局获得的传承点（可能因触及上限而被截断） */
  gained: number
  /** 上限截断前的理论收益 */
  rawGain: number
  victory: boolean
}

/** 根据一局结果结算传承点与生涯记录（纯函数，不落地；调用方负责 saveMeta） */
export function settleRun(state: GameState, meta: MetaState): SettleResult {
  if (state.mode === 'rogue') return settleRogueRun(state, meta)
  const victory = state.phase === 'victory'
  const day = Math.min(state.day, 50)
  const rawGain = victory
    ? TALENT_POINTS_VICTORY
    : Math.min(TALENT_POINTS_DEFEAT_MAX, Math.floor(day / TALENT_POINTS_DEFEAT_PER_DAYS))
  const earned = Math.min(TALENT_POINT_CAP, meta.earned + rawGain)
  const gained = earned - meta.earned
  return {
    meta: {
      ...meta,
      earned,
      runs: meta.runs + 1,
      victories: meta.victories + (victory ? 1 : 0),
      bestDay: Math.max(meta.bestDay, day),
    },
    gained,
    rawGain,
    victory,
  }
}

export function settleGameOnce(state: GameState): SettleResult | null {
  const meta = loadMeta()
  if (meta.settledGameIds.includes(state.gameId)) {
    return { meta, gained: 0, rawGain: 0, victory: state.phase === 'victory' }
  }
  const result = settleRun(state, meta)
  result.meta.settledGameIds = [...meta.settledGameIds, state.gameId]
  return saveMeta(result.meta) ? result : null
}

/** 肉鸽模式结算：按坚守天数与击退波次阶梯给点（无胜利，守到覆灭为止） */
function settleRogueRun(state: GameState, meta: MetaState): SettleResult {
  const rawGain = Math.min(
    ROGUE_POINTS_MAX,
    Math.floor(state.day / ROGUE_POINTS_PER_DAYS) + Math.floor(state.wavesFaced / ROGUE_POINTS_PER_WAVES),
  )
  const earned = Math.min(TALENT_POINT_CAP, meta.earned + rawGain)
  const gained = earned - meta.earned
  return {
    meta: {
      ...meta,
      earned,
      rogue: {
        runs: meta.rogue.runs + 1,
        bestDay: Math.max(meta.rogue.bestDay, state.day),
        bestWave: Math.max(meta.rogue.bestWave, state.wavesFaced),
      },
    },
    gained,
    rawGain,
    victory: false,
  }
}
