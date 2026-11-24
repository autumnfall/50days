import { z } from 'zod'
import { HEROES } from './heroes'
import type { GameState } from './state'

const n = z.number()
const count = n.int().nonnegative()
const uint32 = count.max(0xffffffff)
const text = z.string()
const flag = z.boolean()
const resources = z.object({ food: n, wood: n, gold: n })
const units = z.object({ militia: n, archer: n, knight: n, warlord: n })
const soldiers = units.extend({ militia: count, archer: count, knight: count, warlord: count })
const unitId = z.enum(['militia', 'archer', 'knight', 'warlord'])
const wave = z.object({ wave: n, name: text, icon: text, count, hpEach: n, atkEach: n, lootGold: n })
const modifier = z.object({ id: text, name: text, icon: text, desc: text, type: z.enum(['enemy_buff', 'player_debuff']) })
const unitDetails = z.array(z.object({ id: unitId, name: text, icon: text, count, baseAtk: n, baseHp: n, finalAtk: n, finalHp: n }))
const enemyDetails = z.object({ name: text, icon: text, count, baseAtk: n, baseHp: n, finalAtk: n, finalHp: n })
const battleDetails = {
  wave, unitDetails, enemyDetails, won: flag, honorGained: n,
  soldiersLost: soldiers.partial(), soldiersRevived: soldiers.partial(),
  rounds: z.array(z.object({
    round: n, playerDmg: n, enemyDmg: n, enemiesLeft: n, playerLeft: n, note: text.optional(),
    playerDmgByType: units.partial().optional(),
    playerKillsByType: soldiers.partial().optional(),
    playerLostByType: soldiers.partial().optional(),
  })),
}
const effect = z.object({
  resources: resources.partial(), villagers: n, soldiers: units.partial(),
  honor: n, omen: flag, randomBuildingLoss: n, relic: text,
}).partial()
const eventChoice = z.object({
  id: text, label: text, desc: text, flavor: text.optional(), effect,
  reqResources: resources.partial().optional(), reqSoldiers: n.optional(),
})
export const phaseSchema = z.enum(['start', 'playing', 'battle', 'dungeon_result', 'victory', 'defeat'])
export const nationSchema = z.enum(['agriculture', 'military', 'commerce']).nullable()
export const gameStateSchema = z.object({
  gameId: text.min(1),
  phase: phaseSchema,
  mode: z.enum(['classic', 'rogue']),
  rng: uint32,
  run: z.object({ seed: uint32, relics: z.array(text), blessingsReceived: count }).nullable(),
  nation: nationSchema,
  day: count.min(1),
  resources,
  villagers: count,
  assignment: z.object({ food: count, wood: count, gold: count }),
  soldiers,
  buildings: z.object({ farm: count, lumber: count, mine: count, house: count, barracks: count, wall: count, tower: count }),
  skills: z.array(text).transform((ids) => new Set(ids)),
  honor: n,
  upgrades: z.object({ prod: count, def: count, army: count }),
  honorExchange: resources,
  log: z.array(z.object({ day: count, text, kind: z.enum(['info', 'good', 'bad', 'battle', 'event', 'skill']) })),
  battle: z.object({
    ...battleDetails, breached: flag, villagersLost: n, wallLost: n, wallRepaired: n, towersLost: n,
    buildingLost: text.nullable(), lootGold: n, modifier: modifier.nullish(),
  }).nullable(),
  lastIncome: resources.extend({ upkeep: n, starved: n }).nullable(),
  defeatReason: text.nullable(),
  pendingEvent: z.object({ event: z.object({
    id: text, title: text, icon: text, text, kind: z.enum(['good', 'bad', 'neutral']), weight: n,
    choices: z.array(eventChoice).min(1),
  }) }).nullable(),
  omen: flag,
  wavesFaced: count,
  lastWaveDay: count,
  defeatedFinalBoss: flag,
  talents: z.array(text),
  hero: z.object({
    id: text.refine((id) => HEROES.some((hero) => hero.id === id)),
    level: count.min(1), xp: count, growth: count, passives: z.tuple([count, count, count]),
    activeLearned: flag, pendingSkill: flag, skillCooldownUntil: count, dungeonExtraCharges: count,
  }).nullable(),
  dungeon: z.object({
    highestCleared: count, dailyAttempted: flag,
    pendingResult: z.object({ ...battleDetails, floor: count, modifiers: z.array(modifier) }).nullable(),
  }),
}).refine((state) =>
  (state.mode === 'rogue') === (state.run !== null) &&
  (state.phase === 'start' || state.nation !== null) &&
  (state.phase !== 'battle' || state.battle !== null) &&
  (state.phase !== 'dungeon_result' || state.dungeon.pendingResult !== null),
) satisfies z.ZodType<GameState>
