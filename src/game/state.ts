import type { BuildingId, GameEvent, NationId, ResourceId, UnitId, UpgradeId, WaveInfo } from './config'
import type { DungeonModifier } from './dungeon'
import type { HeroState } from './heroes'

export type Phase = 'start' | 'playing' | 'battle' | 'dungeon_result' | 'victory' | 'defeat'

export type GameMode = 'classic' | 'rogue'

/** 肉鸽模式「无尽远征」的 run 状态 */
export interface RogueRun {
  /** 初始种子（展示/同 seed 重开用） */
  seed: number
  /** 已获得的遗物 id（局内持久被动） */
  relics: string[]
  /** 已收到的祝福次数（用于每 3 次一次遗物轮） */
  blessingsReceived: number
}

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

export interface UnitDetail {
  id: UnitId
  name: string
  icon: string
  count: number
  baseAtk: number
  baseHp: number
  finalAtk: number
  finalHp: number
}

export interface EnemyDetail {
  name: string
  icon: string
  count: number
  baseHp: number
  baseAtk: number
  finalHp: number
  finalAtk: number
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
  /** 参战各兵种的基础与最终属性，便于玩家查看科技/天赋/英雄加成 */
  unitDetails: UnitDetail[]
  /** 敌军基础与最终属性 */
  enemyDetails: EnemyDetail
  /** 肉鸽模式：本波附带的战场词条 */
  modifier?: DungeonModifier | null
}

export interface Income {
  food: number
  wood: number
  gold: number
  upkeep: number
  starved: number
}

export interface GameState {
  gameId: string
  phase: Phase
  mode: GameMode
  /** 种子化 PRNG 当前状态（所有局内随机的唯一随机源，可序列化） */
  rng: number
  /** 肉鸽模式 run 状态（经典模式为 null） */
  run: RogueRun | null
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
  /** 本局英雄（未招募为 null） */
  hero: HeroState | null
  /** 地牢探险状态 */
  dungeon: {
    highestCleared: number
    dailyAttempted: boolean
    pendingResult: DungeonResult | null
  }
}

export interface DungeonResult {
  floor: number
  wave: WaveInfo
  modifiers: DungeonModifier[]
  rounds: BattleRound[]
  won: boolean
  soldiersLost: Partial<Record<UnitId, number>>
  soldiersRevived: Partial<Record<UnitId, number>>
  honorGained: number
  unitDetails: UnitDetail[]
  enemyDetails: EnemyDetail
}
