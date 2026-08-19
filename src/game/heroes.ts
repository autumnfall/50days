// ============================================================
// 英雄系统 —— 英雄定义、成长状态与升级/技能规则
// 英雄不是作战单位，而是与文明并列的开局选择（文明 + 英雄构成一局的基调），
// 提供独立于科技/天赋/遗物的新成长维度：一个成长状态 + 3 被动 + 1 主动。
// ============================================================

/** 英雄等级上限 */
export const HERO_MAX_LEVEL = 10
/** 每级所需经验（索引 0 = 1→2 级）。累计 63 点，约第 45 天可满级 */
export const HERO_XP_THRESHOLDS = [3, 4, 5, 6, 7, 8, 9, 10, 11]
/** 被动技能 1/2/3 级所需的英雄等级 */
export const PASSIVE_LEVEL_REQUIREMENTS = [1, 3, 5]
/** 主动技能解锁等级 */
export const ACTIVE_UNLOCK_LEVEL = 6

export interface HeroPassiveDef {
  id: string
  name: string
  /** 每一级（1~3 级）的效果数值 */
  values: number[]
  /** 将某级数值格式化为效果描述 */
  desc: (value: number) => string
}

export interface HeroActiveDef {
  id: string
  name: string
  desc: string
  /** 冷却天数（从激活当天算起） */
  cooldownDays: number
  /** 伏击：开战时削减敌军数量的比例 */
  ambushRatio: number
}

export interface HeroDef {
  id: string
  name: string
  title: string
  icon: string
  desc: string
  /** 成长状态名（如「战功」） */
  growthName: string
  growthDesc: string
  passives: HeroPassiveDef[]
  active: HeroActiveDef
}

export interface HeroState {
  id: string
  level: number
  /** 当前等级内已积累的经验 */
  xp: number
  /** 成长状态（李牧：战功） */
  growth: number
  /** 三个被动技能各自的等级（0 = 未学习） */
  passives: [number, number, number]
  activeLearned: boolean
  /** 主动技已激活，等待下一场战斗触发（不可叠加） */
  pendingSkill: boolean
  /** 主动技冷却截止天数（day >= 此值时可再次激活） */
  skillCooldownUntil: number
}

export const HEROES: HeroDef[] = [
  {
    id: 'limu',
    name: '李牧',
    title: '战国名将 · 雁门铁壁',
    icon: '🛡️',
    desc: '常年镇守雁门，示弱诱敌、一战破匈奴十万骑。胜仗越多，部队越有他的风范。',
    growthName: '战功',
    growthDesc: '战斗胜利 +1，失败 -2（最低为 0）',
    passives: [
      {
        id: 'veteran',
        name: '久经沙场',
        values: [0.01, 0.02, 0.03],
        desc: (v) => `每点战功使全体士兵攻击 +${Math.round(v * 100)}%`,
      },
      {
        id: 'tuntian',
        name: '屯田戍边',
        values: [0.01, 0.02, 0.03],
        desc: (v) => `每座民居每日 +${Math.round(v * 100)} 食物，且食物采集效率 +${Math.round(v * 100)}%`,
      },
      {
        id: 'outnumbered',
        name: '以少胜多',
        values: [0.15, 0.3, 0.5],
        desc: (v) => `敌军数量超过我方士兵时，我方伤害 +${Math.round(v * 100)}%`,
      },
    ],
    active: {
      id: 'ambush',
      name: '大破匈奴',
      desc: '激活后挂起：下一场战斗（敌袭或地牢）敌军数量 -15%，且敌方首轮无法行动。战败也会消耗。',
      cooldownDays: 5,
      ambushRatio: 0.15,
    },
  },
]

export function getHeroDef(id: string): HeroDef | undefined {
  return HEROES.find((h) => h.id === id)
}

export function createHeroState(id: string): HeroState {
  return { id, level: 1, xp: 0, growth: 0, passives: [0, 0, 0], activeLearned: false, pendingSkill: false, skillCooldownUntil: 0 }
}

/** 升到下一级所需经验（满级返回 Infinity） */
export function heroXpNeeded(level: number): number {
  return level >= HERO_MAX_LEVEL ? Infinity : HERO_XP_THRESHOLDS[level - 1]
}

/** n → n+1 级所需荣耀 = n × 2 */
export function heroUpgradeCost(level: number): number {
  return level * 2
}

/** 可用技能点 = 等级 - 已投入点数（3 被动 + 主动各 1 点） */
export function heroSkillPoints(hero: HeroState): number {
  const spent = hero.passives[0] + hero.passives[1] + hero.passives[2] + (hero.activeLearned ? 1 : 0)
  return hero.level - spent
}

export function canUpgradeHero(hero: HeroState, honor: number): { ok: boolean; reason?: string } {
  if (hero.level >= HERO_MAX_LEVEL) return { ok: false, reason: '已满级' }
  const need = heroXpNeeded(hero.level)
  if (hero.xp < need) return { ok: false, reason: `经验不足（${hero.xp}/${need}）` }
  const cost = heroUpgradeCost(hero.level)
  if (honor < cost) return { ok: false, reason: `荣耀不足（需 ${cost}）` }
  return { ok: true }
}

export function canLearnPassive(hero: HeroState, index: number): { ok: boolean; reason?: string } {
  const cur = hero.passives[index]
  if (cur >= 3) return { ok: false, reason: '已满级' }
  if (heroSkillPoints(hero) <= 0) return { ok: false, reason: '技能点不足' }
  const req = PASSIVE_LEVEL_REQUIREMENTS[cur]
  if (hero.level < req) return { ok: false, reason: `需要英雄等级 ${req}` }
  return { ok: true }
}

export function canLearnActive(hero: HeroState): { ok: boolean; reason?: string } {
  if (hero.activeLearned) return { ok: false, reason: '已习得' }
  if (hero.level < ACTIVE_UNLOCK_LEVEL) return { ok: false, reason: `需要英雄等级 ${ACTIVE_UNLOCK_LEVEL}` }
  if (heroSkillPoints(hero) <= 0) return { ok: false, reason: '技能点不足' }
  return { ok: true }
}

export function canActivateHeroSkill(hero: HeroState, day: number): { ok: boolean; reason?: string } {
  if (!hero.activeLearned) return { ok: false, reason: '尚未习得' }
  if (hero.pendingSkill) return { ok: false, reason: '已挂起，等待下一场战斗' }
  if (day < hero.skillCooldownUntil) return { ok: false, reason: `冷却中（第 ${hero.skillCooldownUntil} 天恢复）` }
  return { ok: true }
}

/** 当前被动效果数值（未学习返回 0） */
export function passiveValue(hero: HeroState, index: number): number {
  const lv = hero.passives[index]
  if (lv <= 0) return 0
  const def = getHeroDef(hero.id)
  return def ? def.passives[index].values[lv - 1] : 0
}

/** 战斗结算：胜 → 战功+1、经验+1；败 → 战功-2（下限 0）。返回新状态 */
export function applyBattleToHero(hero: HeroState, won: boolean): HeroState {
  if (won) return { ...hero, growth: hero.growth + 1, xp: hero.xp + 1 }
  return { ...hero, growth: Math.max(0, hero.growth - 2) }
}
