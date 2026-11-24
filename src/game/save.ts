// 存档正文与列表摘要共用一次写入，旧版分离存档仍可读取。
import { z } from 'zod'
import type { GameState, Phase } from './state'
import type { NationId } from './config'
import { gameStateSchema, nationSchema, phaseSchema } from './save-schema'

const SAVE_KEY_PREFIX = 'fiftyDays_save_'
const AUTOSAVE_KEY = 'fiftyDays_autosave'
const RECOVER_KEY = 'fiftyDays_recover_autosave'
const VERSION = 1

export interface SaveMetadata {
  slot: number
  day: number
  nation: NationId | null
  timestamp: number
  phase: Phase
}

const metadataSchema = z.object({
  slot: z.number().int(), day: z.number().int().positive(), nation: nationSchema,
  timestamp: z.number().nonnegative(), phase: phaseSchema,
})
const envelopeSchema = z.object({ version: z.literal(VERSION), metadata: metadataSchema, state: z.unknown() })
const objectSchema = z.looseObject({})
const saveKey = (slot: number) => slot === 0 ? AUTOSAVE_KEY : SAVE_KEY_PREFIX + slot
const legacyMetaKey = (key: string) => key + '_meta'
const encodeState = (state: GameState) => ({ ...state, skills: [...state.skills] })

// 旧档没有对局 ID，同一份旧快照多次读取时仍生成相同 ID。
function legacyHash(raw: string): number {
  let hash = 2166136261
  for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619)
  return hash >>> 0
}

function migrateReport(value: unknown) {
  const report = objectSchema.safeParse(value)
  if (!report.success) return value
  const { wave, ...fields } = report.data
  const enemy = objectSchema.safeParse(wave).data
  return {
    unitDetails: [],
    enemyDetails: enemy && {
      name: enemy.name, icon: enemy.icon, count: enemy.count,
      baseAtk: enemy.atkEach, finalAtk: enemy.atkEach, baseHp: enemy.hpEach, finalHp: enemy.hpEach,
    },
    ...fields, wave,
  }
}

function migrateLegacy(value: Record<string, unknown>, raw: string) {
  const hash = legacyHash(raw)
  const dungeon = objectSchema.safeParse(value.dungeon).data
  const run = objectSchema.safeParse(value.run).data
  const hero = objectSchema.safeParse(value.hero).data
  return {
    ...value,
    gameId: value.gameId ?? `legacy-${hash.toString(36)}-${raw.length}`,
    mode: value.mode ?? 'classic',
    rng: value.rng ?? hash,
    talents: value.talents ?? [],
    soldiers: { warlord: 0, ...objectSchema.safeParse(value.soldiers).data },
    run: run ? { blessingsReceived: 0, ...run } : value.run ?? null,
    hero: hero ? { dungeonExtraCharges: 0, ...hero } : value.hero ?? null,
    battle: migrateReport(value.battle),
    dungeon: dungeon
      ? { ...dungeon, pendingResult: migrateReport(dungeon.pendingResult) }
      : value.dungeon ?? { highestCleared: 0, dailyAttempted: false, pendingResult: null },
  }
}

type LoadResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: 'empty' | 'invalid' | 'unavailable' }

function decode(raw: string): LoadResult {
  try {
    const value = objectSchema.parse(JSON.parse(raw))
    const state = 'version' in value ? envelopeSchema.parse(value).state : migrateLegacy(value, raw)
    return { ok: true, state: gameStateSchema.parse(state) }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

export function saveGame(state: GameState, slot: number): boolean {
  try {
    const metadata = { slot, day: state.day, nation: state.nation, timestamp: Date.now(), phase: state.phase }
    localStorage.setItem(saveKey(slot), JSON.stringify({ version: VERSION, metadata, state: encodeState(state) }))
    return true
  } catch {
    return false
  }
}

export function loadGame(slot: number): LoadResult {
  try {
    const raw = localStorage.getItem(saveKey(slot))
    return raw === null ? { ok: false, reason: 'empty' } : decode(raw)
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

function getSaveMetadata(slot: number): SaveMetadata | null {
  try {
    const key = saveKey(slot)
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const envelope = envelopeSchema.safeParse(JSON.parse(raw))
    if (envelope.success) return { ...envelope.data.metadata, slot }
    const legacy = metadataSchema.safeParse(JSON.parse(localStorage.getItem(legacyMetaKey(key)) ?? 'null'))
    if (legacy.success) return { ...legacy.data, slot }
  } catch {
    // 仍为有数据的损坏槽位提供读取错误或删除入口。
    try { if (localStorage.getItem(saveKey(slot)) === null) return null } catch { return null }
  }
  return { slot, day: 1, nation: null, timestamp: 0, phase: 'playing' }
}

export function getAllSaveMetadata(): (SaveMetadata | null)[] {
  return [0, 1, 2, 3].map(getSaveMetadata)
}

export function hasAnySave(): boolean {
  return getAllSaveMetadata().some(Boolean)
}

export function readRecovery(): GameState | null {
  try {
    const raw = sessionStorage.getItem(RECOVER_KEY)
    const result = raw ? decode(raw) : null
    return result?.ok ? result.state : null
  } catch {
    return null
  }
}

export function clearRecovery() {
  try { sessionStorage.removeItem(RECOVER_KEY) } catch { /* 存储不可用 */ }
}

export function queueRecovery(state: GameState): boolean {
  try {
    sessionStorage.setItem(RECOVER_KEY, JSON.stringify(encodeState(state)))
    return true
  } catch {
    return false
  }
}

export function deleteSave(slot: number): boolean {
  try {
    localStorage.removeItem(saveKey(slot))
    localStorage.removeItem(legacyMetaKey(saveKey(slot)))
    return true
  } catch {
    return false
  }
}
