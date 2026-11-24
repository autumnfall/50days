import {
  canActivateHeroSkill, canLearnActive, canLearnPassive, canUpgradeHero,
  getHeroDef, heroGrowth, heroUpgradeCost, heroXpNeeded, passiveValue, type HeroState,
} from './heroes'
import type { GameState } from './state'
import { pushLog } from './log'

// ---------------- 英雄 ----------------

/** 英雄升级：经验达标后花费荣耀（n→n+1 需 n×2），每级获得 1 技能点 */
export function upgradeHero(s: GameState): GameState {
  if (s.phase !== 'playing' || !s.hero) return s
  if (!canUpgradeHero(s.hero, s.honor).ok) return s
  const cost = heroUpgradeCost(s.hero.level)
  const hero: HeroState = { ...s.hero, level: s.hero.level + 1, xp: s.hero.xp - heroXpNeeded(s.hero.level) }
  const name = getHeroDef(hero.id)?.name ?? '英雄'
  return {
    ...s,
    honor: s.honor - cost,
    hero,
    log: pushLog(s, `🛡️ ${name} 升至 ${hero.level} 级！获得 1 技能点`, 'skill'),
  }
}

/** 学习/强化被动技能（index 0~2），消耗 1 技能点 */
export function learnHeroPassive(s: GameState, index: number): GameState {
  if (s.phase !== 'playing' || !s.hero) return s
  if (index < 0 || index > 2) return s
  if (!canLearnPassive(s.hero, index).ok) return s
  const passives = [...s.hero.passives] as [number, number, number]
  passives[index] += 1
  const def = getHeroDef(s.hero.id)
  const p = def?.passives[index]
  return {
    ...s,
    hero: { ...s.hero, passives },
    log: pushLog(s, `🛡️ ${def?.name} 习得「${p?.name}」Lv${passives[index]}：${p ? p.desc(p.values[passives[index] - 1]) : ''}`, 'skill'),
  }
}

/** 学习主动技能，消耗 1 技能点 */
export function learnHeroActive(s: GameState): GameState {
  if (s.phase !== 'playing' || !s.hero) return s
  if (!canLearnActive(s.hero).ok) return s
  const def = getHeroDef(s.hero.id)
  return {
    ...s,
    hero: { ...s.hero, activeLearned: true },
    log: pushLog(s, `🛡️ ${def?.name} 习得主动技「${def?.active.name}」！`, 'skill'),
  }
}

/** 激活主动技：挂起至下一场战斗触发（不可叠加），并进入冷却 */
export function activateHeroSkill(s: GameState): GameState {
  if (s.phase !== 'playing' || !s.hero) return s
  if (!canActivateHeroSkill(s.hero, s.day).ok) return s
  const def = getHeroDef(s.hero.id)
  if (!def) return s
  // 霍去病·千里奔袭：效果为“当日额外一次地牢”，立即生效，不需要挂起
  const isRaid = s.hero.id === 'huoqubing'
  const hero: HeroState = {
    ...s.hero,
    pendingSkill: isRaid ? false : true,
    skillCooldownUntil: s.day + def.active.cooldownDays,
    dungeonExtraCharges: isRaid ? 1 : s.hero.dungeonExtraCharges,
  }
  const note = isRaid
    ? `🏇「${def.active.name}」已就绪：今日可额外挑战地牢一次！`
    : `🏹「${def.active.name}」已就绪：下一场战斗将伏击敌军！`
  return { ...s, hero, log: pushLog(s, note, 'skill') }
}

// ---------------- 英雄效果计算辅助函数 ----------------

/** 当前英雄成长状态（霍去病按地牢层数实时计算） */
export function currentHeroGrowth(s: GameState): number {
  return s.hero ? heroGrowth(s.hero, s) : 0
}

/** 采集的英雄加成倍率（霍去病·军功授田、列奥尼达·遗志励耕） */
export function heroGatherMult(s: GameState): number {
  if (!s.hero) return 1
  const g = currentHeroGrowth(s)
  let mult = 1
  // 霍去病·军功授田：征尘每 1 层 +N%（封顶 10）
  const huoFarm = passiveValue(s.hero, 1)
  if (huoFarm > 0) mult += g * huoFarm
  // 列奥尼达·遗志励耕：战意每点 +N%
  const leoFarm = passiveValue(s.hero, 2)
  if (leoFarm > 0) mult += g * leoFarm
  return mult
}

/** 士兵攻击的英雄倍率（李牧·久经沙场、霍去病·威震漠北） */
export function heroSoldierAtkMult(s: GameState, isDungeon: boolean): number {
  if (!s.hero) return 1
  const g = currentHeroGrowth(s)
  let mult = 1
  // 李牧·久经沙场
  const limuAtk = passiveValue(s.hero, 0)
  if (limuAtk > 0) mult += g * limuAtk
  // 霍去病·威震漠北：仅普通敌袭
  if (!isDungeon) {
    const huoAtk = passiveValue(s.hero, 2)
    if (huoAtk > 0) mult += g * huoAtk
  }
  return mult
}

/** 士兵生命的英雄倍率（列奥尼达·盾墙） */
export function heroSoldierHpMult(s: GameState): number {
  if (!s.hero) return 1
  const g = currentHeroGrowth(s)
  const leoHp = passiveValue(s.hero, 0)
  if (leoHp > 0) return 1 + g * leoHp
  return 1
}

/** 敌方伤害的英雄倍率（诸葛亮·八阵图） */
export function heroEnemyDmgMult(s: GameState): number {
  if (!s.hero) return 1
  const g = currentHeroGrowth(s)
  const zhugeDef = passiveValue(s.hero, 0)
  if (zhugeDef > 0) return Math.max(0, 1 - g * zhugeDef)
  return 1
}

/** 食物消耗的英雄倍率（诸葛亮·木牛流马） */
export function heroFoodUpkeepMult(s: GameState): number {
  if (!s.hero) return 1
  const zhugeSupply = passiveValue(s.hero, 1)
  if (zhugeSupply > 0) return Math.max(0, 1 - zhugeSupply)
  return 1
}
