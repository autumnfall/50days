// ============================================================
// 地牢探险系统 —— 主动讨伐，无城墙/箭塔，纯军队+科技
// ============================================================

import { getWave, type WaveInfo } from './config'
import type { GameState, UnitId, BattleRound } from './engine'
import { unitAtk, unitHp } from './engine'

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
  wave: i + 5, // 层1=wave5, 层10=wave15 (跳过wave14,用15)
  name: t.name,
  icon: t.icon,
  honor: i + 2, // 层1=2荣耀, 层10=11荣耀
}))

// 修正: 层10用wave15而非wave14
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
  // 敌人增益
  { id: 'thick_skin', name: '厚甲', icon: '🛡️', desc: '敌人生命 +30%', type: 'enemy_buff' },
  { id: 'berserk', name: '狂暴', icon: '💢', desc: '敌人攻击 +25%', type: 'enemy_buff' },
  { id: 'swarm', name: '虫潮', icon: '🐜', desc: '敌人数量 +40%', type: 'enemy_buff' },
  { id: 'thorns', name: '荆棘', icon: '🌿', desc: '玩家攻击时反弹 15% 伤害', type: 'enemy_buff' },
  { id: 'frenzy', name: '狂怒', icon: '🔥', desc: '每损失一个敌人，其余敌人攻击 +5%', type: 'enemy_buff' },
  // 玩家减益
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
    // 随机 1 个（增益或减益）
    const all = [...enemyBuffs, ...playerDebuffs]
    return [all[Math.floor(Math.random() * all.length)]]
  }
  // 8-10层：1增益 + 1减益
  const eb = enemyBuffs[Math.floor(Math.random() * enemyBuffs.length)]
  const pd = playerDebuffs[Math.floor(Math.random() * playerDebuffs.length)]
  return [eb, pd]
}

// ---------------- 战力预估（模糊） ----------------

export interface PowerEstimate {
  min: number
  max: number
}

/** 预估敌人战力区间（模糊显示，不暴露精确数值） */
export function estimateDungeonPower(wave: number): PowerEstimate {
  const w = getWave(wave)
  const base = Math.round(w.count * w.hpEach * w.atkEach / 10)
  return {
    min: Math.round(base * 0.8),
    max: Math.round(base * 1.4),
  }
}

// ---------------- 地牢战斗 ----------------

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

/** 检查地牢中是否拥有某技能（用于战斗计算） */
function dungeonHasSkill(s: GameState, id: string): boolean {
  return s.skills.has(id)
}

/** 进入地牢战斗 */
export function resolveDungeonBattle(s: GameState, floor: number): { state: GameState; result: DungeonResult } {
  const floorDef = DUNGEON_FLOORS[floor - 1]
  const wave = getWave(floorDef.wave)
  const modifiers = rollModifiers(floor)

  // 应用敌人增益到 wave 数据
  let enemyCount = wave.count
  let enemyHp = wave.hpEach
  let enemyAtk = wave.atkEach

  const modIds = modifiers.map((m) => m.id)
  if (modIds.includes('thick_skin')) enemyHp = Math.round(enemyHp * 1.3)
  if (modIds.includes('berserk')) enemyAtk = Math.round(enemyAtk * 1.25 * 10) / 10
  if (modIds.includes('swarm')) enemyCount = Math.round(enemyCount * 1.4)

  // 创建敌人
  const enemies: { hp: number; maxHp: number; atk: number }[] = Array.from(
    { length: enemyCount },
    () => ({ hp: enemyHp, maxHp: enemyHp, atk: enemyAtk }),
  )

  // 创建玩家单位（应用玩家减益）
  const playerDebuff = modifiers.find((m) => m.type === 'player_debuff')
  let atkMult = 1
  let hpMult = 1
  if (playerDebuff?.id === 'weakened') atkMult = 0.8
  if (playerDebuff?.id === 'fragile') hpMult = 0.75

  const units: { id: UnitId; hp: number; maxHp: number; atk: number }[] = []
  ;(['knight', 'archer', 'militia'] as UnitId[]).forEach((id) => {
    for (let i = 0; i < s.soldiers[id]; i++) {
      units.push({
        id,
        hp: Math.round(unitHp(s, id) * hpMult),
        maxHp: Math.round(unitHp(s, id) * hpMult),
        atk: Math.round(unitAtk(s, id) * atkMult),
      })
    }
  })

  // 技能标记
  const firstRoundBonus = dungeonHasSkill(s, 'mi_warhorn') ? 1.4 : 1
  const bloodlust = dungeonHasSkill(s, 'mi_bloodlust')
  const militiaAll = dungeonHasSkill(s, 'ag_allmilitia')
  const discipline = dungeonHasSkill(s, 'mi_discipline')
  const soulguard = dungeonHasSkill(s, 'mi_soulguard')

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

      // 我方伤害
      let playerDmg = units.reduce((sum, u) => sum + u.atk, 0) + bloodlustStacks
      if (militiaAll) playerDmg += s.villagers * 2
      playerDmg = Math.round(playerDmg * (0.9 + Math.random() * 0.2))
      if (round === 1) playerDmg = Math.round(playerDmg * firstRoundBonus)
      if (hasChaos && round === 1) playerDmg = Math.round(playerDmg * 0.5)

      // 狂怒：每损失一个敌人，其余敌人攻击 +5%
      let enemyFrenzyMult = 1
      if (hasFrenzy) {
        enemyFrenzyMult = 1 + kills * 0.05
      }

      // 敌方伤害
      let enemyDmg = enemies.reduce((sum, e) => sum + e.atk, 0) * enemyFrenzyMult
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

      // 荆棘反伤
      let thornNote: string | undefined
      if (hasThorns) {
        const thorn = Math.round(playerDmg * 0.15)
        // 反伤随机击杀玩家单位
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

      // 敌方伤害 → 士兵（无城墙）
      dmg = enemyDmg
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
        enemyDmg: Math.round(enemyDmg),
        enemiesLeft: enemies.length,
        playerLeft: units.length,
        note: thornNote ?? (bloodlust && roundKills > 0 && bloodlustStacks > 0 ? `🔥 嗜血 +${bloodlustStacks}` : undefined),
      })
    }
  }

  // 结算士兵损失
  const survivors: Record<UnitId, number> = { militia: 0, archer: 0, knight: 0 }
  units.forEach((u) => survivors[u.id]++)
  ;(['militia', 'archer', 'knight'] as UnitId[]).forEach((id) => {
    const lost = s.soldiers[id] - survivors[id]
    if (lost > 0) report.soldiersLost[id] = lost
  })

  // 英魂庇护（未被诅咒禁用时）
  if (soulguard) {
    ;(['militia', 'archer', 'knight'] as UnitId[]).forEach((id) => {
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
    if (dungeonHasSkill(ns, 'mi_honor')) honor += 1
    if (dungeonHasSkill(ns, 'co_war_economy')) honor += 1
    report.honorGained = honor
    ns = {
      ...ns,
      honor: ns.honor + honor,
      dungeon: {
        ...ns.dungeon,
        highestCleared: Math.max(ns.dungeon.highestCleared, floor),
        dailyAttempted: true,
      },
      log: [...ns.log, { day: ns.day, text: `🏆 地牢第${floor}层通关！获得 ${honor} 荣耀`, kind: 'good' }],
    }
  } else {
    ns = {
      ...ns,
      dungeon: { ...ns.dungeon, dailyAttempted: true },
      log: [...ns.log, { day: ns.day, text: `💀 地牢第${floor}层挑战失败，部队撤退`, kind: 'bad' }],
    }
  }

  return { state: ns, result }
}
