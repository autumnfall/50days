// ============================================================
// 英雄系统 —— 英雄定义、成长状态与升级/技能规则
// 英雄不是作战单位，而是与文明并列的开局选择（文明 + 英雄构成一局的基调），
// 提供独立于科技/天赋/遗物的新成长维度：一个成长状态 + 3 被动 + 1 主动。
// ============================================================

import type { GameState } from './engine'

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
  /** 伏击：开战时削减敌军数量的比例（李牧） */
  ambushRatio?: number
  /** 空城计：每点筹谋吓退敌军的比例（诸葛亮） */
  scareRatio?: number
  /** 温泉关：城墙吸收量翻倍倍数（列奥尼达） */
  wallAbsorbMult?: number
  /** 温泉关：城墙被摧毁后士兵伤害加成（列奥尼达） */
  breachDmgMult?: number
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
  /** 成长状态上限（未设置则无上限） */
  growthCap?: number
  passives: HeroPassiveDef[]
  active: HeroActiveDef
}

export interface HeroState {
  id: string
  level: number
  /** 当前等级内已积累的经验 */
  xp: number
  /** 成长状态（李牧：战功；诸葛亮：筹谋；列奥尼达：战意） */
  growth: number
  /** 三个被动技能各自的等级（0 = 未学习） */
  passives: [number, number, number]
  activeLearned: boolean
  /** 主动技已激活，等待下一场战斗触发（不可叠加） */
  pendingSkill: boolean
  /** 主动技冷却截止天数（day >= 此值时可再次激活） */
  skillCooldownUntil: number
  /** 霍去病·千里奔袭：当日额外可进入地牢的次数 */
  dungeonExtraCharges: number
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
    growthCap: 30,
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
  {
    id: 'huoqubing',
    name: '霍去病',
    title: '冠军侯 · 封狼居胥',
    icon: '🏇',
    desc: '十七岁深入大漠，六天转战五国，以战养战、封狼居胥。地牢越深，他的威名越盛。',
    growthName: '征尘',
    growthDesc: '地牢最高通关层数（封顶 10）',
    growthCap: 10,
    passives: [
      {
        id: 'honor_loot',
        name: '封狼居胥',
        values: [1, 2, 3],
        desc: (v) => `通关任意地牢层，额外荣誉 +${v}`,
      },
      {
        id: 'farm_from_dungeon',
        name: '军功授田',
        values: [0.01, 0.02, 0.03],
        desc: (v) => `征尘每有 1 层，全体村民采集效率 +${Math.round(v * 100)}%（封顶 10 层）`,
      },
      {
        id: 'normal_atk_from_floors',
        name: '威震漠北',
        values: [0.01, 0.02, 0.03],
        desc: (v) => `敌袭战斗中士兵攻击 +征尘×${Math.round(v * 100)}%（封顶 10 层）`,
      },
    ],
    active: {
      id: 'raid',
      name: '千里奔袭',
      desc: '激活后当天可额外进入地牢一次（突破每日 1 次限制），第二次地牢敌军数量 -10%。',
      cooldownDays: 6,
    },
  },
  {
    id: 'zhugeliang',
    name: '诸葛亮',
    title: '卧龙 · 鞠躬尽瘁',
    icon: '🪶',
    desc: '隆中对定三分、草船借箭、空城退敌。每过一天，他的筹谋便深一分。',
    growthName: '筹谋',
    growthDesc: '每过一天 +1（上限 10）',
    growthCap: 10,
    passives: [
      {
        id: 'eight_trigrams',
        name: '八阵图',
        values: [0.005, 0.01, 0.015],
        desc: (v) => `敌军伤害 -筹谋×${Math.round(v * 1000) / 10}%（上限 -${Math.round(v * 1000) / 10 * 10}%）`,
      },
      {
        id: 'supply',
        name: '木牛流马',
        values: [0.1, 0.2, 0.3],
        desc: (v) => `士兵食物消耗 -${Math.round(v * 100)}%`,
      },
      {
        id: 'borrow_arrows',
        name: '草船借箭',
        values: [1, 2, 3],
        desc: (v) => `敌袭来袭时，按敌军数量获得 ${v} 木材/只`,
      },
    ],
    active: {
      id: 'empty_city',
      name: '空城计',
      desc: '激活后挂起：下一次敌袭开战时，按筹谋×3% 吓退敌军（上限 30%），消耗一半筹谋（向上取整）。',
      cooldownDays: 7,
      scareRatio: 0.03,
    },
  },
  {
    id: 'leonidas',
    name: '列奥尼达',
    title: '斯巴达之王 · 温泉关',
    icon: '🛡️',
    desc: '率三百勇士死守温泉关，全员战死不后退。士兵的牺牲会化为战意，激励生者。',
    growthName: '战意',
    growthDesc: '士兵阵亡 +1（无上限）',
    passives: [
      {
        id: 'shield_wall',
        name: '盾墙',
        values: [0.002, 0.004, 0.006],
        desc: (v) => `全体士兵生命 +战意×${Math.round(v * 1000) / 10}%`,
      },
      {
        id: 'last_stand',
        name: '殊死一搏',
        values: [0.5, 1, 1.5],
        desc: (v) => `士兵阵亡时对随机敌人造成其攻击力 ${Math.round(v * 100)}% 的伤害`,
      },
      {
        id: 'legacy_farm',
        name: '遗志励耕',
        values: [0.002, 0.004, 0.006],
        desc: (v) => `村民采集效率 +战意×${Math.round(v * 1000) / 10}%`,
      },
    ],
    active: {
      id: 'thermopylae',
      name: '温泉关',
      desc: '激活后挂起：下一场战斗城墙吸收量翻倍；若城墙被摧毁，本场后续回合士兵伤害 +50%。',
      cooldownDays: 7,
      wallAbsorbMult: 2,
      breachDmgMult: 0.5,
    },
  },
]

export function getHeroDef(id: string): HeroDef | undefined {
  return HEROES.find((h) => h.id === id)
}

export function createHeroState(id: string): HeroState {
  return { id, level: 1, xp: 0, growth: 0, passives: [0, 0, 0], activeLearned: false, pendingSkill: false, skillCooldownUntil: 0, dungeonExtraCharges: 0 }
}

/** 英雄当前成长状态（对李牧/诸葛亮/列奥尼达读存储值；霍去病按地牢最高层计算并封顶） */
export function heroGrowth(hero: HeroState, state: GameState): number {
  const def = getHeroDef(hero.id)
  const cap = def?.growthCap ?? Infinity
  if (hero.id === 'huoqubing') return Math.min(cap, state.dungeon.highestCleared)
  return Math.min(cap, hero.growth)
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
  const def = getHeroDef(hero.id)
  const cap = def?.growthCap ?? Infinity
  if (won) return { ...hero, growth: Math.min(cap, hero.growth + 1), xp: hero.xp + 1 }
  return { ...hero, growth: Math.max(0, hero.growth - 2) }
}
