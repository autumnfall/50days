// ============================================================
// 《五十日坚守》数值配置（已经过完整对局模拟平衡验证）
// ============================================================

import { RELICS, getRelic } from './relics'

export type ResourceId = 'food' | 'wood' | 'gold'

export const RESOURCE_INFO: Record<ResourceId, { name: string; icon: string; color: string }> = {
  food: { name: '食物', icon: '🌾', color: 'text-amber-300' },
  wood: { name: '木材', icon: '🪵', color: 'text-orange-300' },
  gold: { name: '金币', icon: '🪙', color: 'text-yellow-300' },
}

export const CONFIG = {
  totalDays: 50,
  // ---- 随机波次 ----
  firstWaveDay: 3, // 第 3 天起可能出现敌军
  waveChanceStep: 0.2, // 每天来袭概率 +20%
  waveGrowth: 1.09, // 每波强度指数增长系数
  wandererInterval: 3, // 每 3 天一位流浪者来投
  start: { villagers: 6, food: 40, wood: 30, gold: 20 },
  basePopCap: 10, // 初始住房上限（村民+士兵共享）
  houseCapPer: 6, // 每座民居 +6
  gatherBase: 3, // 木材/金币基础产出
  foodGatherBase: 4, // 食物基础产出
  farmBonus: 2, // 农场每级加成
  villagerUpkeep: 2, // 村民每天消耗 2 食物
  starveRatio: 2, // 饥荒时每 2 点缺口死 1 人
  recruitCost: { food: 8 } as Partial<Record<ResourceId, number>>, // 招募村民
  // ---- 肉鸽模式「无尽远征」----
  rogue: {
    blessingInterval: 3, // 每 3 天一次「远征祝福」三选一
    bossInterval: 25, // 每 25 天一个强化 Boss 波（必来）
    dayScaling: 0.01, // 常规波次强度随天数递增系数（× (1 + day × 系数)）
    bossWavePerDay: 0.5, // Boss 波强度 = max(下一波, day × 该系数)
  },
}

// ---------------- 建筑 ----------------

export type BuildingId = 'farm' | 'lumber' | 'mine' | 'house' | 'barracks' | 'wall' | 'tower'

export interface BuildingDef {
  id: BuildingId
  name: string
  icon: string
  desc: string
  max: number
  cost: (level: number) => Partial<Record<ResourceId, number>> // level = 当前已建造数量/等级
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  farm: {
    id: 'farm', name: '农场', icon: '🌻', max: 5,
    desc: `每位务农村民食物产出 +${CONFIG.farmBonus}`,
    cost: (l) => ({ wood: 8 + l * 6 }),
  },
  lumber: {
    id: 'lumber', name: '伐木场', icon: '🪓', max: 5,
    desc: '每位伐木村民木材产出 +1',
    cost: (l) => ({ wood: 8 + l * 6 }),
  },
  mine: {
    id: 'mine', name: '矿场', icon: '⛏️', max: 5,
    desc: '每位采矿村民金币产出 +1',
    cost: (l) => ({ wood: 10 + l * 7 }),
  },
  house: {
    id: 'house', name: '民居', icon: '🏠', max: 8,
    desc: `村民住房上限 +${CONFIG.houseCapPer}`,
    cost: (l) => ({ wood: 10 + l * 7 }),
  },
  barracks: {
    id: 'barracks', name: '兵营', icon: '🏯', max: 3,
    desc: 'Lv1 解锁民兵 · Lv2 解锁弓箭手 · Lv3 解锁骑士',
    cost: (l) => ({ wood: 15 + l * 12, gold: 5 + l * 8 }),
  },
  wall: {
    id: 'wall', name: '城墙', icon: '🧱', max: 5,
    desc: `战斗中每级可吸收 ${35} 点伤害`,
    cost: (l) => ({ wood: 12 + l * 9 }),
  },
  tower: {
    id: 'tower', name: '箭塔', icon: '🗼', max: 5,
    desc: `战斗中每座每轮造成 ${10} 点伤害`,
    cost: (l) => ({ wood: 10 + l * 6, gold: 5 + l * 4 }),
  },
}

export const WALL_ABSORB_PER = 35
export const TOWER_DMG = 10

// ---------------- 兵种 ----------------

export type UnitId = 'militia' | 'archer' | 'knight' | 'warlord'

/** 基础三兵种（战神为局外天赋解锁的衍生兵种，不参与常规循环） */
export const BASE_UNIT_IDS = ['militia', 'archer', 'knight'] as const satisfies readonly UnitId[]
export type BaseUnitId = (typeof BASE_UNIT_IDS)[number]

export interface UnitDef {
  id: UnitId
  name: string
  icon: string
  hp: number
  atk: number
  upkeep: number // 每天食物消耗
  reqBarracks: number
  cost: Partial<Record<ResourceId, number>>
}

export const UNITS: Record<UnitId, UnitDef> = {
  militia: {
    id: 'militia', name: '民兵', icon: '⚔️',
    hp: 14, atk: 7, upkeep: 3, reqBarracks: 1,
    cost: { food: 5, gold: 3 },
  },
  archer: {
    id: 'archer', name: '弓箭手', icon: '🏹',
    hp: 9, atk: 12, upkeep: 3, reqBarracks: 2,
    cost: { food: 8, gold: 7 },
  },
  knight: {
    id: 'knight', name: '骑士', icon: '🐎',
    hp: 24, atk: 20, upkeep: 4, reqBarracks: 3,
    cost: { food: 14, gold: 12 },
  },
  // 局外天赋「战神」解锁：兵营 Lv4，全局唯一。
  // hp/atk 仅为展示用基础值，实战属性 = 民兵/弓箭手/骑士各 1 名当前生效属性之和（见 engine.unitAtk/unitHp）
  warlord: {
    id: 'warlord', name: '战神', icon: '🦾',
    hp: 47, atk: 39, upkeep: 10, reqBarracks: 4,
    cost: { food: 100, gold: 100 },
  },
}

// ---------------- 敌人波次 ----------------

export interface WaveInfo {
  wave: number
  name: string
  icon: string
  count: number
  hpEach: number
  atkEach: number
  lootGold: number
}

const ENEMY_TIERS = [
  { name: '哥布林掠夺者', icon: '👺' },
  { name: '野狼群', icon: '🐺' },
  { name: '兽人战士', icon: '👹' },
  { name: '黑暗骑士团', icon: '🌑' },
]

export function getWave(wave: number): WaveInfo {
  const tier = ENEMY_TIERS[Math.min(ENEMY_TIERS.length - 1, Math.floor((wave - 1) / 3))]
  return {
    wave,
    name: tier.name,
    icon: tier.icon,
    count: Math.round(2 + wave * 2.2),
    hpEach: Math.round(4 + wave * 3.5),
    atkEach: Math.round((2 + wave * 1.1) * 10) / 10,
    lootGold: 6 + wave * 5,
  }
}

// ============================================================
// 国家 / 文明
// ============================================================

export type NationId = 'agriculture' | 'military' | 'commerce'

export interface NationDef {
  id: NationId
  name: string
  icon: string
  title: string
  desc: string
  bonus: string[] // 展示用
}

export const NATIONS: Record<NationId, NationDef> = {
  agriculture: {
    id: 'agriculture', name: '丰饶农耕国', icon: '🌾', title: '大地之子',
    desc: '世代耕耘的民族，深谙土地之道，以充沛的粮食供养庞大的人口。',
    bonus: ['食物采集 +1/人', '招募村民费用 -25%', '开局食物 +15'],
  },
  military: {
    id: 'military', name: '铁血军事国', icon: '⚔️', title: '战争之裔',
    desc: '崇尚武力的战士国度，每个孩童从小接受战斗训练，军纪严明。',
    bonus: ['全体士兵攻击 +2', '训练费用 -20%', '开局即有 1 座兵营'],
  },
  commerce: {
    id: 'commerce', name: '黄金商业联邦', icon: '🪙', title: '商路之主',
    desc: '纵横商路的富裕联邦，金币流转间创造财富，以财力换取一切。',
    bonus: ['金币采集 +1/人', '建筑费用 -15%', '开局金币 +15'],
  },
}

// ============================================================
// 技能树（用荣耀点解锁）
// ============================================================

export type SkillId = string

export interface SkillDef {
  id: SkillId
  nation: NationId
  column: string // 所属列（每文明 3 列）
  tier: 1 | 2 | 3 // 层级，列内 T1→T2→T3 依次前置
  name: string
  icon: string
  desc: string
  cost: number // 荣耀点：T1=2 / T2=4 / T3=6
  requires?: SkillId // 前置技能
}

export const SKILL_TIER_COST = { 1: 2, 2: 4, 3: 6 } as const

export const SKILLS: SkillDef[] = [
  // ================= 丰饶农耕国 =================
  // -- 耕作之道 --
  { id: 'ag_irrigate', nation: 'agriculture', column: '耕作之道', tier: 1, name: '精耕细作', icon: '🚜', cost: 2,
    desc: '每位务农村民食物产出再 +1' },
  { id: 'ag_fertility', nation: 'agriculture', column: '耕作之道', tier: 2, name: '丰收祝福', icon: '🌽', cost: 4, requires: 'ag_irrigate',
    desc: '农场加成翻倍（每座 +4 而非 +2）' },
  { id: 'ag_abundance', nation: 'agriculture', column: '耕作之道', tier: 3, name: '生生不息', icon: '🌟', cost: 6, requires: 'ag_fertility',
    desc: '食物采集总产出 +25%；流浪者每 2 天来投' },
  // -- 聚落之道 --
  { id: 'ag_granary', nation: 'agriculture', column: '聚落之道', tier: 1, name: '大型谷仓', icon: '🛖', cost: 2,
    desc: '住房上限 +4，且饥荒时少饿死 1 人' },
  { id: 'ag_recruit', nation: 'agriculture', column: '聚落之道', tier: 2, name: '招贤纳士', icon: '🧲', cost: 4, requires: 'ag_granary',
    desc: '招募村民费用 -50%；流浪者每次来投 +2 人' },
  { id: 'ag_population', nation: 'agriculture', column: '聚落之道', tier: 3, name: '人丁兴旺', icon: '🏘️', cost: 6, requires: 'ag_recruit',
    desc: '住房上限再 +8；饥荒再少饿死 1 人（合计 2 人）' },
  // -- 农兵之道 --
  { id: 'ag_militia', nation: 'agriculture', column: '农兵之道', tier: 1, name: '民兵训练', icon: '🛡️', cost: 2,
    desc: '民兵攻击 +3，生命 +6' },
  { id: 'ag_allmilitia', nation: 'agriculture', column: '农兵之道', tier: 2, name: '全民皆兵', icon: '🌿', cost: 4, requires: 'ag_militia',
    desc: '战斗中每位村民协防，每轮我方伤害 +（村民数 × 2）' },
  { id: 'ag_earthwall', nation: 'agriculture', column: '农兵之道', tier: 3, name: '大地壁垒', icon: '🏞️', cost: 6, requires: 'ag_allmilitia',
    desc: '城墙每级吸收 +15；被摧毁的城墙战后自动修复一半' },

  // ================= 铁血军事国 =================
  // -- 武备之道 --
  { id: 'mi_drill', nation: 'military', column: '武备之道', tier: 1, name: '严格操练', icon: '🎯', cost: 2,
    desc: '全体士兵攻击再 +1' },
  { id: 'mi_veteran', nation: 'military', column: '武备之道', tier: 2, name: '百战老兵', icon: '🎖️', cost: 4, requires: 'mi_drill',
    desc: '骑士攻击 +6，弓箭手攻击 +3' },
  { id: 'mi_bloodlust', nation: 'military', column: '武备之道', tier: 3, name: '嗜血狂怒', icon: '🔥', cost: 6, requires: 'mi_veteran',
    desc: '每击杀 3 敌，全体攻 +1（战斗内累积）' },
  // -- 坚甲之道 --
  { id: 'mi_armor', nation: 'military', column: '坚甲之道', tier: 1, name: '铁甲锻造', icon: '🪖', cost: 2,
    desc: '全体士兵生命 +4' },
  { id: 'mi_discipline', nation: 'military', column: '坚甲之道', tier: 2, name: '钢铁纪律', icon: '⚙️', cost: 4, requires: 'mi_armor',
    desc: '全体士兵生命再 +6；战斗中每轮敌方伤害 × 0.9' },
  { id: 'mi_soulguard', nation: 'military', column: '坚甲之道', tier: 3, name: '英魂庇护', icon: '💂', cost: 6, requires: 'mi_discipline',
    desc: '每场战斗结束时，各兵种复活其阵亡数的 30%（向下取整）' },
  // -- 军势之道 --
  { id: 'mi_warhorn', nation: 'military', column: '军势之道', tier: 1, name: '战争号角', icon: '📯', cost: 2,
    desc: '战斗首轮我方伤害 +40%' },
  { id: 'mi_honor', nation: 'military', column: '军势之道', tier: 2, name: '军功授爵', icon: '🏅', cost: 4, requires: 'mi_warhorn',
    desc: '战斗胜利荣耀 +1；训练费用 × 0.9' },
  { id: 'mi_kingarmy', nation: 'military', column: '军势之道', tier: 3, name: '王者之师', icon: '👑', cost: 6, requires: 'mi_honor',
    desc: '全体士兵攻 +3、血 +6；训练费用 × 0.8' },

  // ================= 黄金商业联邦 =================
  // -- 商路之道 --
  { id: 'co_tariff', nation: 'commerce', column: '商路之道', tier: 1, name: '商路关税', icon: '🏦', cost: 2,
    desc: '金币采集产出 +20%' },
  { id: 'co_caravan', nation: 'commerce', column: '商路之道', tier: 2, name: '四方商队', icon: '🐪', cost: 4, requires: 'co_tariff',
    desc: '每天按金币存量 2% 获得利息；「远行商队」事件权重 ×2' },
  { id: 'co_goldwater', nation: 'commerce', column: '商路之道', tier: 3, name: '黄金水道', icon: '💫', cost: 6, requires: 'co_caravan',
    desc: '利息提升至 5%；战斗缴获 +25%；资源兑换荣耀费用 × 0.75' },
  // -- 重工之道 --
  { id: 'co_engineer', nation: 'commerce', column: '重工之道', tier: 1, name: '能工巧匠', icon: '⚙️', cost: 2,
    desc: '箭塔伤害 +4，城墙吸收 +10/级' },
  { id: 'co_steel', nation: 'commerce', column: '重工之道', tier: 2, name: '精钢工艺', icon: '🏗️', cost: 4, requires: 'co_engineer',
    desc: '箭塔伤害再 +6；建筑费用 × 0.9' },
  { id: 'co_fortress', nation: 'commerce', column: '重工之道', tier: 3, name: '钢铁要塞', icon: '🏰', cost: 6, requires: 'co_steel',
    desc: '城墙吸收再 +20/级，箭塔伤害再 +10' },
  // -- 雇佣之道 --
  { id: 'co_market', nation: 'commerce', column: '雇佣之道', tier: 1, name: '繁荣市集', icon: '🏪', cost: 2,
    desc: '每位采矿村民金币产出再 +1' },
  { id: 'co_mercenary', nation: 'commerce', column: '雇佣之道', tier: 2, name: '雇佣兵制', icon: '💰', cost: 4, requires: 'co_market',
    desc: '训练士兵只花金币（免食物），费用 -15%' },
  { id: 'co_war_economy', nation: 'commerce', column: '雇佣之道', tier: 3, name: '战争经济', icon: '👑', cost: 6, requires: 'co_mercenary',
    desc: '战斗缴获金币 +50%，荣耀点 +1/胜' },
]

export function getSkillsForNation(nation: NationId): SkillDef[] {
  return SKILLS.filter((s) => s.nation === nation)
}

export function getColumnsForNation(nation: NationId): string[] {
  return [...new Set(getSkillsForNation(nation).map((s) => s.column))]
}

// ============================================================
// 终局：无限升级 / 资源兑换荣耀
// ============================================================

export type UpgradeId = 'prod' | 'def' | 'army'

export const UPGRADES: Record<UpgradeId, { name: string; icon: string; desc: string }> = {
  prod: { name: '生产建筑增强', icon: '🏗️', desc: '每级：农场/伐木场/矿场/民居 建造上限 +1' },
  def: { name: '防御建筑增强', icon: '🧱', desc: '每级：城墙/箭塔上限 +1，城墙吸收 +7，箭塔伤害 +2' },
  army: { name: '军队增强', icon: '⚔️', desc: '每级：民兵 攻+1/血+2，弓箭手 攻+2/血+2，骑士 攻+3/血+4' },
}

export const HONOR_EXCHANGE_BASE = 100 // 初始 100 资源 → 1 荣耀，每次翻倍

// ============================================================
// 随机事件（多选项抉择，数值随天数缩放）
// ============================================================

/** 事件效果的通用增量描述（由引擎应用） */
export interface EventEffect {
  resources?: Partial<Record<ResourceId, number>>
  villagers?: number
  soldiers?: Partial<Record<UnitId, number>>
  honor?: number
  omen?: boolean
  /** 概率使随机 1 座已建建筑 -1 级（如 0.5） */
  randomBuildingLoss?: number
  /** 获得遗物（肉鸽模式「远征祝福」） */
  relic?: string
}

export interface EventChoice {
  id: string
  label: string // 选项名
  desc: string // 效果描述（缩放后动态生成）
  flavor?: string // 附加说明（括号内展示）
  effect: EventEffect
  /** 资源门槛（需 ≥ 该数值才可选，随天数缩放） */
  reqResources?: Partial<Record<ResourceId, number>>
  /** 士兵数量门槛 */
  reqSoldiers?: number
}

export interface GameEvent {
  id: string
  icon: string
  title: string
  text: string
  kind: 'good' | 'bad' | 'neutral'
  choices: EventChoice[]
  when?: (day: number) => boolean
  weight: number
}

export const EVENTS: GameEvent[] = [
  {
    id: 'trader', icon: '🐫', title: '远行商队', kind: 'good', weight: 9,
    text: '一支来自远方的商队在村外扎营，愿意与你做些交易。',
    choices: [
      { id: 'wood_for_gold', label: '出售木材', desc: '', flavor: '以木换金',
        effect: { resources: { wood: -10, gold: 9 } },
        reqResources: { wood: 10 } },
      { id: 'food_for_gold', label: '出售粮食', desc: '', flavor: '以粮换金',
        effect: { resources: { food: -12, gold: 8 } },
        reqResources: { food: 12 } },
      { id: 'buy_supplies', label: '购入补给', desc: '', flavor: '金币换物资',
        effect: { resources: { gold: -8, food: 10, wood: 4 } },
        reqResources: { gold: 8 } },
    ],
  },
  {
    id: 'refugees', icon: '🚶', title: '流民来投', kind: 'good', weight: 9,
    text: '一群逃难的流民在村口徘徊，恳求收留。他们看起来饿极了。',
    choices: [
      { id: 'take_in', label: '敞开大门收留', desc: '', flavor: '给他们一个家',
        effect: { villagers: 2, resources: { food: -8 } },
        reqResources: { food: 8 } },
      { id: 'some_food', label: '施舍干粮打发', desc: '', flavor: '善举传开',
        effect: { resources: { food: -4 }, honor: 1 },
        reqResources: { food: 4 } },
      { id: 'turn_away', label: '紧闭村门', desc: '',
        effect: {} },
    ],
  },
  {
    id: 'wild_herd', icon: '🦌', title: '鹿群出没', kind: 'good', weight: 8,
    text: '猎人在森林边发现了鹿群的踪迹，是难得的加餐机会。',
    choices: [
      { id: 'big_hunt', label: '组织大规模围猎', desc: '', flavor: '制作陷阱',
        effect: { resources: { food: 12, wood: -4 } },
        reqResources: { wood: 4 } },
      { id: 'small_hunt', label: '小规模狩猎', desc: '',
        effect: { resources: { food: 6 } } },
      { id: 'spare', label: '放生积德', desc: '', flavor: '善有善报',
        effect: { honor: 1 } },
    ],
  },
  {
    id: 'plague', icon: '🤢', title: '疫病蔓延', kind: 'bad', weight: 7,
    text: '村中开始流行怪病，病患日渐增多，必须立刻决断。',
    choices: [
      { id: 'burn', label: '隔离焚烧病患居所', desc: '', flavor: '控制疫情',
        effect: { resources: { food: -10, wood: -4 } },
        reqResources: { food: 10, wood: 4 } },
      { id: 'healer', label: '重金聘请游方医师', desc: '', flavor: '药到病除',
        effect: { resources: { gold: -10 } },
        reqResources: { gold: 10 } },
      { id: 'endure', label: '听天由命', desc: '',
        effect: { villagers: -2 } },
    ],
  },
  {
    id: 'bandits', icon: '🥷', title: '小股盗匪', kind: 'bad', weight: 7,
    text: '一伙盗匪盯上了村庄的粮仓，派人送来"勒索信"。',
    choices: [
      { id: 'fight', label: '派士兵驱逐', desc: '', flavor: '犒赏士兵，威名远扬',
        effect: { resources: { food: -4 }, honor: 1 },
        reqSoldiers: 2 },
      { id: 'pay', label: '交保护费', desc: '',
        effect: { resources: { gold: -8 } },
        reqResources: { gold: 8 } },
      { id: 'lose_food', label: '任他们抢粮', desc: '',
        effect: { resources: { food: -12 } } },
    ],
  },
  {
    id: 'storm', icon: '⛈️', title: '暴风雨', kind: 'bad', weight: 6,
    text: '狂风暴雨即将过境，简陋的木屋恐怕撑不住。',
    choices: [
      { id: 'reinforce', label: '连夜加固房屋', desc: '', flavor: '安然无恙',
        effect: { resources: { wood: -8 } },
        reqResources: { wood: 8 } },
      { id: 'save_supplies', label: '优先抢救物资', desc: '',
        effect: { resources: { food: -5, wood: -5 } } },
      { id: 'pray', label: '祈祷天晴', desc: '', flavor: '听凭天意',
        effect: { randomBuildingLoss: 0.5 } },
    ],
  },
  {
    id: 'wandering_knight', icon: '🐴', title: '游侠骑士', kind: 'good', weight: 5,
    when: (day) => day > 10,
    text: '一位身披旧甲的游侠骑士路过村庄，对你的事业颇感兴趣。',
    choices: [
      { id: 'recruit_him', label: '设宴款待，邀其留下', desc: '',
        effect: { resources: { food: -10 }, soldiers: { knight: 1 } },
        reqResources: { food: 10 } },
      { id: 'gift', label: '赠礼结交', desc: '',
        effect: { resources: { gold: -8 }, honor: 2 },
        reqResources: { gold: 8 } },
      { id: 'farewell', label: '礼貌送别', desc: '',
        effect: {} },
    ],
  },
  {
    id: 'old_well', icon: '🕳️', title: '古井藏宝', kind: 'good', weight: 5,
    text: '村民在清理村口的古井时，隐约看到井底有金属的反光。',
    choices: [
      { id: 'dive', label: '派人下井打捞', desc: '', flavor: '犒劳勇士',
        effect: { resources: { gold: 18, food: -3 } },
        reqResources: { food: 3 } },
      { id: 'careful', label: '小心打捞', desc: '',
        effect: { resources: { gold: 10 } } },
      { id: 'seal', label: '填井保平安', desc: '', flavor: '破除迷信',
        effect: { honor: 1 } },
    ],
  },
  {
    id: 'omen', icon: '🌑', title: '不祥之兆', kind: 'neutral', weight: 6,
    when: () => true,
    text: '夜空中划过血色的流星，老人们说那是黑暗大军的眼线……',
    choices: [
      { id: 'ritual', label: '举行驱邪祭祀', desc: '', flavor: '消除预兆',
        effect: { resources: { food: -10 } },
        reqResources: { food: 10 } },
      { id: 'ignore_omen', label: '不予理会', desc: '', flavor: '下一波敌人将更凶猛！',
        effect: { omen: true } },
    ],
  },
  {
    id: 'festival', icon: '🎉', title: '丰收祭典', kind: 'good', weight: 6,
    when: (day) => day > 8,
    text: '又到了一年一度的祭典时节，村民们都盼着热闹一番。',
    choices: [
      { id: 'grand', label: '大办宴席', desc: '', flavor: '人心振奋',
        effect: { resources: { food: -10 }, honor: 2 },
        reqResources: { food: 10 } },
      { id: 'small', label: '简单庆祝', desc: '', flavor: '外乡人慕名而来',
        effect: { resources: { food: -4 }, villagers: 1 },
        reqResources: { food: 4 } },
      { id: 'cancel', label: '一切从简', desc: '',
        effect: {} },
    ],
  },
  {
    id: 'iron_vein', icon: '⛏️', title: '发现矿脉', kind: 'good', weight: 6,
    when: (day) => day > 6,
    text: '勘探队在山谷深处发现了一条裸露的铁矿脉。',
    choices: [
      { id: 'deep_mine', label: '全力开采', desc: '', flavor: '工人消耗',
        effect: { resources: { gold: 15, food: -6 } },
        reqResources: { food: 6 } },
      { id: 'shallow', label: '浅层开采', desc: '',
        effect: { resources: { gold: 8 } } },
      { id: 'leave', label: '标记位置，日后再说', desc: '', flavor: '顺带伐木',
        effect: { resources: { wood: 4 } } },
    ],
  },
  {
    id: 'arms_dealer', icon: '🗡️', title: '武器商人', kind: 'neutral', weight: 5,
    when: (day) => day > 5,
    text: '一个神秘的武器商人推着货车进村，车上的兵器寒光凛凛。',
    choices: [
      { id: 'buy_arms', label: '购置武器武装村民', desc: '',
        effect: { resources: { gold: -10 }, soldiers: { militia: 1 } },
        reqResources: { gold: 10 } },
      { id: 'buy_intel', label: '购买敌军情报', desc: '', flavor: '知己知彼',
        effect: { resources: { gold: -5 }, honor: 1 },
        reqResources: { gold: 5 } },
      { id: 'shoo', label: '赶走这个可疑分子', desc: '',
        effect: {} },
    ],
  },
]

// ---------------- 事件数值缩放 ----------------

/** 资源类缩放倍率：第 1 天 ×1.0，第 25 天 ≈×2，第 50 天 ≈×3 */
export function eventResourceMult(day: number): number {
  return 1 + 0.04 * (day - 1)
}

/** 村民/士兵/荣耀类增量：1–15 天不变，16–30 天 +1，31 天起 +2 */
export function eventUnitBonus(day: number): number {
  return day <= 15 ? 0 : day <= 30 ? 1 : 2
}

/** 生成效果的中文描述（基于缩放后数值） */
export function describeEffect(e: EventEffect): string {
  const parts: string[] = []
  if (e.resources) {
    for (const [r, v] of Object.entries(e.resources) as [ResourceId, number][]) {
      if (v !== 0) parts.push(`${v > 0 ? '+' : ''}${v} ${RESOURCE_INFO[r].name}`)
    }
  }
  if (e.villagers) parts.push(`${e.villagers > 0 ? '+' : ''}${e.villagers} 村民`)
  if (e.soldiers) {
    for (const [u, v] of Object.entries(e.soldiers) as [UnitId, number][]) {
      if (v !== 0) parts.push(`+${v} ${UNITS[u].name}`)
    }
  }
  if (e.honor) parts.push(`+${e.honor} 荣耀`)
  if (e.omen) parts.push('下一波敌人增强')
  if (e.randomBuildingLoss) parts.push(`${Math.round(e.randomBuildingLoss * 100)}% 概率随机 1 座建筑 -1 级`)
  if (e.relic) parts.push(`获得遗物【${getRelic(e.relic)?.name ?? e.relic}】`)
  return parts.length ? parts.join('，') : '无效果'
}

/** 生成随天数缩放的事件副本（desc 同步生成，结算直接用缩放值） */
export function scaleEvent(event: GameEvent, day: number): GameEvent {
  const mult = eventResourceMult(day)
  const bonus = eventUnitBonus(day)
  const scaleRes = (v: number): number => Math.round(v * mult)
  const scaleUnit = (v: number): number => (v > 0 ? v + bonus : v < 0 ? v - bonus : v)

  return {
    ...event,
    choices: event.choices.map((c) => {
      const e = c.effect
      const scaledEffect: EventEffect = { ...e }
      if (e.resources) {
        scaledEffect.resources = Object.fromEntries(
          (Object.entries(e.resources) as [ResourceId, number][]).map(([r, v]) => [r, scaleRes(v)]),
        )
      }
      if (typeof e.villagers === 'number') scaledEffect.villagers = scaleUnit(e.villagers)
      if (e.soldiers) {
        scaledEffect.soldiers = Object.fromEntries(
          (Object.entries(e.soldiers) as [UnitId, number][]).map(([u, v]) => [u, scaleUnit(v)]),
        )
      }
      if (typeof e.honor === 'number') scaledEffect.honor = scaleUnit(e.honor)
      const scaledReq = c.reqResources
        ? Object.fromEntries(
            (Object.entries(c.reqResources) as [ResourceId, number][]).map(([r, v]) => [r, scaleRes(v)]),
          )
        : undefined
      return {
        ...c,
        effect: scaledEffect,
        reqResources: scaledReq,
        desc: describeEffect(scaledEffect),
      }
    }),
  }
}

export function pickRandomEvent(day: number, random: () => number, opts?: { traderBoost?: boolean }): GameEvent | null {
  if (random() > 0.4) return null // 40% 概率触发
  const pool = EVENTS.filter((e) => !e.when || e.when(day))
  const total = pool.reduce((sum, e) => sum + e.weight * (opts?.traderBoost && e.id === 'trader' ? 2 : 1), 0)
  let roll = random() * total
  for (const e of pool) {
    roll -= e.weight * (opts?.traderBoost && e.id === 'trader' ? 2 : 1)
    if (roll <= 0) return e
  }
  return null
}

// ============================================================
// 肉鸽模式「远征祝福」—— 每 3 天一次三选一（局内构筑）
// 祝福效果复用 EventEffect DSL，由 engine 组装成 GameEvent 挂起抉择
// ============================================================

export interface BlessingDef {
  id: string
  name: string
  icon: string
  desc: string
  effect: EventEffect
  weight: number
}

export const BLESSINGS: BlessingDef[] = [
  // ---- 遗物类（核心构筑）----
  ...Object.values(RELICS).map((r): BlessingDef => ({
    id: `relic_${r.id}`, name: r.name, icon: r.icon, weight: r.weight,
    desc: `获得遗物：${r.desc}（本次远征持续生效）`,
    effect: { relic: r.id },
  })),
  // ---- 资源补给类 ----
  { id: 'b_food', name: '天降粮草', icon: '🌾', weight: 8,
    desc: '立即获得 30 食物、10 木材', effect: { resources: { food: 30, wood: 10 } } },
  { id: 'b_gold', name: '意外之财', icon: '💰', weight: 8,
    desc: '立即获得 25 金币', effect: { resources: { gold: 25 } } },
  { id: 'b_wood', name: '林中宝藏', icon: '🪵', weight: 8,
    desc: '立即获得 25 木材、5 金币', effect: { resources: { wood: 25, gold: 5 } } },
  // ---- 人员类 ----
  { id: 'b_villagers', name: '义民来投', icon: '🧑‍🌾', weight: 8,
    desc: '+3 村民', effect: { villagers: 3 } },
  { id: 'b_militia', name: '义勇军', icon: '⚔️', weight: 7,
    desc: '+2 民兵', effect: { soldiers: { militia: 2 } } },
  { id: 'b_archer', name: '神射手加盟', icon: '🏹', weight: 5,
    desc: '+1 弓箭手、+5 金币', effect: { soldiers: { archer: 1 }, resources: { gold: 5 } } },
  // ---- 荣耀类 ----
  { id: 'b_honor', name: '威名远扬', icon: '🏅', weight: 7,
    desc: '+3 荣耀', effect: { honor: 3 } },
  // ---- 代价型（高风险高回报）----
  { id: 'b_blood_pact', name: '血之契约', icon: '🩸', weight: 4,
    desc: '+6 荣耀，但 -2 村民', effect: { honor: 6, villagers: -2 } },
  { id: 'b_dark_bargain', name: '黑暗交易', icon: '🌑', weight: 4,
    desc: '+40 金币、+20 食物，但下一波敌人增强', effect: { resources: { gold: 40, food: 20 }, omen: true } },
]
