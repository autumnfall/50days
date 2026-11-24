import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chooseNation, createGame, enterDungeon, train } from './engine'
import { loadGame, saveGame } from './save'
import { loadMeta, settleGameOnce } from './meta'

const data = new Map<string, string>()
const game = () => chooseNation(createGame([], { mode: 'rogue', seed: 42 }), 'military')

beforeEach(() => {
  data.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('存档', () => {
  it('保存地牢结算时保留对局 ID、随机状态和战报', () => {
    const state = enterDungeon(train(game(), 'militia'), 1)
    expect(state.phase).toBe('dungeon_result')
    expect(saveGame(state, 1)).toBe(true)
    expect(data.size).toBe(1)
    expect(loadGame(1)).toEqual({ ok: true, state })
  })

  it('旧战报没有参战明细时仍可载入，同一快照的对局 ID 稳定', () => {
    const state = enterDungeon(train(game(), 'militia'), 1)
    const { gameId, ...legacy } = JSON.parse(JSON.stringify({ ...state, skills: [...state.skills] }))
    expect(gameId).toBe(state.gameId)
    delete legacy.dungeon.pendingResult.unitDetails
    delete legacy.dungeon.pendingResult.enemyDetails
    data.set('fiftyDays_save_1', JSON.stringify(legacy))
    expect(loadGame(1)).toMatchObject({ ok: true, state: { gameId: expect.stringMatching(/^legacy-/) } })
    expect(loadGame(1)).toEqual(loadGame(1))
  })

  it('区分损坏存档和不可用的存储', () => {
    data.set('fiftyDays_save_1', '{"phase":"playing","day":1,"resources":{}}')
    expect(loadGame(1)).toEqual({ ok: false, reason: 'invalid' })
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('unavailable') },
      setItem: () => { throw new Error('quota exceeded') },
    })
    expect(loadGame(1)).toEqual({ ok: false, reason: 'unavailable' })
    expect(saveGame(game(), 1)).toBe(false)
  })
})

it('重新读档后不会再次结算同一局，同种子的新局可以结算', () => {
  const ended = { ...game(), phase: 'defeat' as const, day: 30 }
  expect(settleGameOnce(ended)?.gained).toBe(3)
  saveGame(ended, 1)
  const loaded = loadGame(1)
  if (!loaded.ok) throw new Error('Unable to load fixture')
  expect(settleGameOnce(loaded.state)?.gained).toBe(0)
  expect(loadMeta().rogue.runs).toBe(1)
  expect(settleGameOnce({ ...game(), phase: 'defeat', day: 30 })?.gained).toBe(3)
  expect(loadMeta().rogue.runs).toBe(2)
})
