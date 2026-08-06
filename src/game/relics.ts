// ============================================================
// 肉鸽模式「无尽远征」—— 遗物定义（纯数据，无引擎依赖）
// 遗物 = 局内持久被动，通过「远征祝福」三选一获得，本次远征持续生效。
// 效果以 effects 字段声明，由 effects.collectMods 统一收集结算。
// ============================================================

import type { EffectContrib } from './effects'

export type RelicId =
  | 'harvest_totem' | 'whetstone' | 'sturdy_plans' | 'war_banner'
  | 'merchant_charm' | 'field_medic' | 'thick_walls' | 'longbow'
  | 'golden_touch' | 'pioneer_boots' | 'sacred_grain' | 'war_drum'

export interface RelicDef {
  id: RelicId
  name: string
  icon: string
  desc: string
  /** 祝福池抽取权重 */
  weight: number
  /** 被动效果声明（由 effects.collectMods 统一收集结算） */
  effects: EffectContrib
}

export const RELICS: Record<RelicId, RelicDef> = {
  harvest_totem: { id: 'harvest_totem', name: '丰收图腾', icon: '🌽', weight: 10,
    desc: '食物采集总产出 +15%',
    effects: { gatherMults: { food: [1.15] } } },
  whetstone: { id: 'whetstone', name: '磨刀石', icon: '🗡️', weight: 10,
    desc: '全体士兵攻击 +10%',
    effects: { unitAtkMult: 1.1 } },
  sturdy_plans: { id: 'sturdy_plans', name: '坚固图纸', icon: '📐', weight: 10,
    desc: '建筑费用 -10%',
    effects: { buildCostMults: [0.9] } },
  war_banner: { id: 'war_banner', name: '战旗', icon: '🚩', weight: 8,
    desc: '每击退一波敌军，+1 民兵加入',
    effects: { flags: { warBanner: true } } },
  merchant_charm: { id: 'merchant_charm', name: '商人护符', icon: '🪙', weight: 8,
    desc: '每天按金币存量 +3% 利息（可与商队技能叠加）',
    effects: { interestRateAdd: 0.03 } },
  field_medic: { id: 'field_medic', name: '急救包', icon: '💊', weight: 8,
    desc: '每场战斗结束后，各兵种挽回阵亡数的 20%',
    effects: { reviveRatios: [0.2] } },
  thick_walls: { id: 'thick_walls', name: '堡垒基石', icon: '🧱', weight: 8,
    desc: '城墙每级吸收 +20%',
    effects: { wallAbsorbMult: 1.2 } },
  longbow: { id: 'longbow', name: '长弓图纸', icon: '🏹', weight: 8,
    desc: '箭塔伤害 +25%',
    effects: { towerDmgMult: 1.25 } },
  golden_touch: { id: 'golden_touch', name: '点金手', icon: '✨', weight: 8,
    desc: '战斗缴获金币 +30%',
    effects: { lootMults: [1.3] } },
  pioneer_boots: { id: 'pioneer_boots', name: '拓荒者之靴', icon: '🥾', weight: 6,
    desc: '流浪者每次来投额外 +1 人',
    effects: { wandererBonus: 1 } },
  sacred_grain: { id: 'sacred_grain', name: '神圣谷种', icon: '🌾', weight: 6,
    desc: '饥荒饿死人数减半',
    effects: { flags: { sacredGrain: true } } },
  war_drum: { id: 'war_drum', name: '战鼓', icon: '🥁', weight: 6,
    desc: '战斗首轮我方伤害 +25%（与战争号角叠乘）',
    effects: { firstRoundMult: 1.25 } },
}

export function getRelic(id: string): RelicDef | undefined {
  return (RELICS as Record<string, RelicDef>)[id]
}
