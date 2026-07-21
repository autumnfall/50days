// ============================================================
// 存档 / 读档 —— 序列化与 localStorage 持久化
// ============================================================

import type { GameState, Phase } from './engine'
import type { NationId } from './config'

const SAVE_KEY_PREFIX = 'fiftyDays_save_'
const AUTOSAVE_KEY = 'fiftyDays_autosave'
const SAVE_SLOTS = 3

export interface SaveMetadata {
  slot: number // 0 = autosave, 1-3 = manual
  day: number
  nation: NationId | null
  timestamp: number
  phase: Phase
}

// ---- 序列化 ----

function serialize(state: GameState): string {
  return JSON.stringify({ ...state, skills: [...state.skills] })
}

function deserialize(json: string): GameState | null {
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed.day !== 'number' || !parsed.resources || !parsed.phase) return null
    return { ...parsed, skills: new Set<string>(parsed.skills ?? []) }
  } catch {
    return null
  }
}

function metaKey(key: string) { return key + '_meta' }

function buildMeta(state: GameState, slot: number): SaveMetadata {
  return { slot, day: state.day, nation: state.nation, timestamp: Date.now(), phase: state.phase }
}

// ---- 写入 ----

function writeSave(key: string, state: GameState, slot: number) {
  try {
    localStorage.setItem(key, serialize(state))
    localStorage.setItem(metaKey(key), JSON.stringify(buildMeta(state, slot)))
  } catch { /* quota exceeded – silently ignore */ }
}

export function saveGame(state: GameState, slot: number) {
  writeSave(SAVE_KEY_PREFIX + slot, state, slot)
}

export function autoSave(state: GameState) {
  if (state.phase === 'defeat' || state.phase === 'victory') return
  writeSave(AUTOSAVE_KEY, state, 0)
}

// ---- 读取 ----

export function loadGame(slot: number): GameState | null {
  const key = slot === 0 ? AUTOSAVE_KEY : SAVE_KEY_PREFIX + slot
  const json = localStorage.getItem(key)
  return json ? deserialize(json) : null
}

export function getSaveMetadata(slot: number): SaveMetadata | null {
  const key = slot === 0 ? AUTOSAVE_KEY : SAVE_KEY_PREFIX + slot
  try {
    const raw = localStorage.getItem(metaKey(key))
    return raw ? JSON.parse(raw) as SaveMetadata : null
  } catch {
    return null
  }
}

export function getAllSaveMetadata(): (SaveMetadata | null)[] {
  return [0, 1, 2, 3].map(getSaveMetadata)
}

export function hasAnySave(): boolean {
  return getAllSaveMetadata().some(Boolean)
}

// ---- 删除 ----

export function deleteSave(slot: number) {
  const key = slot === 0 ? AUTOSAVE_KEY : SAVE_KEY_PREFIX + slot
  localStorage.removeItem(key)
  localStorage.removeItem(metaKey(key))
}
