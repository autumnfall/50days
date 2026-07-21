// ============================================================
// 地牢探险系统 —— 配置数据（纯数据，无引擎依赖）
// ============================================================

import { getWave } from './config'

// ---------------- 地牢层配置 ----------------

export interface DungeonFloor {
  floor: number
  wave: number
  name: string
  icon: string
  honor: number
}

const DUNGEON_TIERS = [
  { name: '地牢入口', icon: '🏚️' },
  { name: '幽暗通道', icon: '🕳️' },
  { name: '毒蛛巢穴', icon: '🕷️' },
  { name: '骸骨大厅', icon: '💀' },
  { name: '熔岩深渊', icon: '🌋' },
  { name: '暗影殿堂', icon: '🌑' },
  { name: '噩梦回廊', icon: '👁️' },
  { name: '诅咒王座', icon: '👑' },
  { name: '虚空裂隙', icon: '🌀' },
  { name: '魔王密室', icon: '😈' },
]

export const DUNGEON_FLOORS: DungeonFloor[] = DUNGEON_TIERS.map((t, i) => ({
  floor: i + 1,
  wave: i + 5,
  name: t.name,
  icon: t.icon,
  honor: i + 2,
}))

DUNGEON_FLOORS[9].wave = 15

// ---------------- 增益/减益系统 ----------------

export type ModifierType = 'enemy_buff' | 'player_debuff'

export interface DungeonModifier {
  id: string
  name: string
  icon: string
  desc: string
  type: ModifierType
}

export const DUNGEON_MODIFIERS: DungeonModifier[] = [
  { id: 'thick_skin', name: '厚甲', icon: '🛡️', desc: '敌人生命 +30%', type: 'enemy_buff' },
  { id: 'berserk', name: '狂暴', icon: '💢', desc: '敌人攻击 +25%', type: 'enemy_buff' },
  { id: 'swarm', name: '虫潮', icon: '🐜', desc: '敌人数量 +40%', type: 'enemy_buff' },
  { id: 'thorns', name: '荆棘', icon: '🌿', desc: '玩家攻击时反弹 15% 伤害', type: 'enemy_buff' },
  { id: 'frenzy', name: '狂怒', icon: '🔥', desc: '每损失一个敌人，其余敌人攻击 +5%', type: 'enemy_buff' },
  { id: 'weakened', name: '虚弱', icon: '📉', desc: '我方部队攻击 -20%', type: 'player_debuff' },
  { id: 'fragile', name: '脆弱', icon: '💔', desc: '我方部队生命 -25%', type: 'player_debuff' },
  { id: 'chaos', name: '混乱', icon: '😵', desc: '首回合我方伤害 -50%', type: 'player_debuff' },
]

/** 按楼层随机抽取修饰：1-3层无，4-7层随机1个，8-10层随机1增益+1减益 */
export function rollModifiers(floor: number): DungeonModifier[] {
  if (floor <= 3) return []
  const enemyBuffs = DUNGEON_MODIFIERS.filter((m) => m.type === 'enemy_buff')
  const playerDebuffs = DUNGEON_MODIFIERS.filter((m) => m.type === 'player_debuff')
  if (floor <= 7) {
    const all = [...enemyBuffs, ...playerDebuffs]
    return [all[Math.floor(Math.random() * all.length)]]
  }
  const eb = enemyBuffs[Math.floor(Math.random() * enemyBuffs.length)]
  const pd = playerDebuffs[Math.floor(Math.random() * playerDebuffs.length)]
  return [eb, pd]
}

// ---------------- 战力预估（模糊） ----------------

export interface PowerEstimate {
  min: number
  max: number
}

/** 预估敌人战力区间（基于DPS，模糊显示±20%） */
export function estimateDungeonPower(wave: number): PowerEstimate {
  const w = getWave(wave)
  const base = Math.round(w.count * w.atkEach)
  return {
    min: Math.round(base * 0.8),
    max: Math.round(base * 1.2),
  }
}
