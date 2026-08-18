import { useState } from 'react'
import { CONFIG, NATIONS, type NationId } from '@/game/config'
import type { GameMode } from '@/game/engine'
import { formatSeed, randomSeed } from '@/game/rng'
import {
  TALENTS, TALENT_BRANCH_INFO, TALENT_BRANCH_ORDER, TALENT_POINT_CAP,
  canActivateTalent, deactivateTalent, loadMeta, saveMeta, talentsCost,
  type MetaState, type TalentDef,
} from '@/game/meta'
import { hasAnySave } from '@/game/save'
import { cn } from '@/lib/utils'

function TalentNode({
  def,
  meta,
  onToggle,
}: {
  def: TalentDef
  meta: MetaState
  onToggle: (id: string) => void
}) {
  const active = meta.talents.includes(def.id)
  const check = canActivateTalent(meta.talents, def.id, meta.earned)
  const clickable = active || check.ok
  return (
    <button
      onClick={() => onToggle(def.id)}
      disabled={!clickable}
      title={`${def.name}（${def.cost} 点）\n${def.desc}${!active && !check.ok ? `\n🔒 ${check.reason}` : ''}`}
      className={cn(
        'w-full rounded-lg border px-3 py-2.5 text-left transition sm:px-2 sm:py-1.5',
        active
          ? def.mechanic
            ? 'border-purple-500 bg-purple-950/40 shadow-sm shadow-purple-500/20'
            : 'border-amber-500 bg-amber-950/40 shadow-sm shadow-amber-500/10'
          : clickable
            ? 'border-stone-700 bg-stone-950/50 hover:border-stone-500 hover:bg-stone-800/60'
            : 'cursor-not-allowed border-stone-800 bg-stone-950/30 opacity-40',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg sm:text-base">{def.icon}</span>
        <span className={cn('flex-1 text-sm font-bold sm:flex-1 sm:truncate sm:text-[11px]', active ? 'text-amber-200' : 'text-stone-300')}>
          {def.name}
        </span>
        <span className={cn('text-xs font-bold sm:text-[10px]', active ? 'text-amber-400' : 'text-stone-500')}>
          {active ? '✓' : `${def.cost}点`}
        </span>
      </div>
      <div className="mt-1 text-xs leading-relaxed text-stone-500 sm:mt-0.5 sm:text-[10px] sm:leading-snug">{def.desc}</div>
    </button>
  )
}

function TalentTree({ meta, setMeta }: { meta: MetaState; setMeta: (m: MetaState) => void }) {
  const used = talentsCost(meta.talents)
  const toggle = (id: string) => {
    const talents = meta.talents.includes(id)
      ? deactivateTalent(meta.talents, id)
      : canActivateTalent(meta.talents, id, meta.earned).ok
        ? [...meta.talents, id]
        : meta.talents
    const next = { ...meta, talents }
    setMeta(next)
    saveMeta(next)
  }
  const reset = () => {
    const next = { ...meta, talents: [] }
    setMeta(next)
    saveMeta(next)
  }

  return (
    <div className="mt-6 rounded-xl border border-stone-700/60 bg-stone-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-widest text-stone-400">— 局外天赋树 —</h2>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-stone-400">
            🌟 传承点 <b className="text-amber-300">{used}</b>
            <span className="text-stone-500"> / {meta.earned}（上限 {TALENT_POINT_CAP}）</span>
          </span>
          {used > 0 && (
            <button
              onClick={reset}
              className="rounded border border-stone-600 px-2 py-0.5 font-bold text-stone-300 transition hover:border-red-500/60 hover:text-red-300"
            >
              免费洗点
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-stone-500">
        通关 +6 点，败北每坚守 15 天 +1 点（最多 +3）。天赋在开局前随时调整，开局后生效整局。
      </p>
      {meta.earned === 0 ? (
        <p className="mt-3 rounded-lg bg-stone-900/60 px-3 py-2 text-center text-[11px] text-stone-500">
          还没有传承点——完成一局游戏（无论胜负）即可获得，用来激活局外天赋。
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TALENT_BRANCH_ORDER.map((branch) => (
            <div key={branch} className="space-y-2">
              <div className="text-center text-sm font-bold tracking-widest text-stone-400 sm:text-[11px]">
                {TALENT_BRANCH_INFO[branch].icon} {TALENT_BRANCH_INFO[branch].name}
              </div>
              {TALENTS.filter((t) => t.branch === branch).map((def) => (
                <TalentNode key={def.id} def={def} meta={meta} onToggle={toggle} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const MODES: { id: GameMode; name: string; icon: string; tagline: string; desc: string; points: string[] }[] = [
  {
    id: 'classic', name: '经典战役', icon: '🏰', tagline: '坚守 50 天',
    desc: '在第 50 天击败终局 Boss 即可获胜。节奏固定，适合熟悉游戏机制。',
    points: ['第 3 天起敌军随机来袭，逐日递增', '第 50 天终局决战，胜则通关', '通关 +6 传承点，败北最多 +3'],
  },
  {
    id: 'rogue', name: '无尽远征', icon: '💀', tagline: '肉鸽模式 · 守到覆灭',
    desc: '没有终点的远征：敌人一波强过一波，每 3 天一次「远征祝福」三选一，收集遗物构筑你的村庄，每 25 天迎战黑暗领主。',
    points: ['每 3 天祝福三选一，遗物永久生效', '每波敌军附带随机战场词条', '按坚守天数/击退波次结算传承点（最多 +8）'],
  },
]

export default function StartScreen({ onStart, onLoad }: { onStart: (nation: NationId, talents: string[], mode: GameMode, seed?: number) => void; onLoad?: (slot: number) => void }) {
  const [selected, setSelected] = useState<NationId | null>(null)
  const [mode, setMode] = useState<GameMode>('classic')
  const [seed, setSeed] = useState<number>(randomSeed)
  const [meta, setMeta] = useState<MetaState>(loadMeta)

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-b from-stone-950 via-stone-900 to-amber-950/40 px-4 py-8">
      <div className="pointer-events-none absolute inset-0 opacity-20 text-[12rem] leading-none select-none">
        <span className="absolute left-[8%] top-[12%]">🏰</span>
        <span className="absolute right-[10%] top-[18%]">🌲</span>
        <span className="absolute bottom-[8%] left-[15%]">🌲</span>
        <span className="absolute bottom-[12%] right-[12%]">⛰️</span>
      </div>

      <div className="relative w-full max-w-4xl rounded-2xl border border-amber-700/40 bg-stone-900/80 p-6 shadow-2xl backdrop-blur-md sm:p-8">
        <div className="text-center">
          <div className="text-5xl">🏰</div>
          <h1 className="mt-3 text-4xl font-black tracking-widest text-amber-200 sm:text-5xl">五十日坚守</h1>
          <p className="mt-2 text-sm tracking-wider text-stone-400">— 回合制生存策略 · 致敬《50 Years》—</p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-stone-300">
            第 {CONFIG.firstWaveDay} 天起，黑暗大军<b className="text-red-300">随时可能进犯</b>（每天 20% 概率，逐日递增，第 5 天必来），且一波比一波强。
            第 {CONFIG.totalDays} 天将迎来<b className="text-red-300">终局决战</b>，击败最终敌人才能获胜！
          </p>
        </div>

        {/* 模式选择 */}
        <h2 className="mt-7 text-center text-sm font-bold tracking-widest text-stone-400">— 选择游戏模式 —</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => {
            const active = mode === m.id
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  'rounded-xl border-2 p-4 text-left transition',
                  active
                    ? m.id === 'rogue'
                      ? 'border-purple-500 bg-purple-950/30 shadow-lg shadow-purple-500/10'
                      : 'border-amber-500 bg-amber-950/40 shadow-lg shadow-amber-500/10'
                    : 'border-stone-700 bg-stone-950/50 hover:border-stone-500 hover:bg-stone-800/60',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{m.icon}</span>
                  <div>
                    <div className={cn('font-bold', active ? (m.id === 'rogue' ? 'text-purple-200' : 'text-amber-200') : 'text-stone-200')}>{m.name}</div>
                    <div className="text-[10px] tracking-widest text-stone-500">{m.tagline}</div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-stone-400">{m.desc}</p>
                <ul className="mt-2 space-y-1">
                  {m.points.map((p) => (
                    <li key={p} className={cn('flex items-start gap-1 text-[11px]', m.id === 'rogue' ? 'text-purple-300/90' : 'text-emerald-300/90')}>
                      <span className={m.id === 'rogue' ? 'text-purple-500' : 'text-emerald-500'}>✦</span>{p}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {/* 肉鸽模式：种子与生涯纪录 */}
        {mode === 'rogue' && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-purple-800/50 bg-purple-950/20 px-4 py-2.5 text-[12px]">
            <span className="text-stone-300">
              🎲 远征种子 <b className="font-mono text-purple-300">{formatSeed(seed)}</b>
              <span className="text-stone-500">（同一种子的事件/波次序列完全一致）</span>
            </span>
            <button
              onClick={() => setSeed(randomSeed())}
              className="rounded-lg border border-purple-700/60 px-2.5 py-1 font-bold text-purple-300 transition hover:bg-purple-900/40 active:scale-95"
            >
              换一个
            </button>
            {meta.rogue.runs > 0 && (
              <span className="text-stone-500">
                远征生涯：{meta.rogue.runs} 局 · 最长坚守 <b className="text-purple-300">{meta.rogue.bestDay}</b> 天 · 最多击退 <b className="text-purple-300">{meta.rogue.bestWave}</b> 波
              </span>
            )}
          </div>
        )}

        {/* 国家选择 */}
        <h2 className="mt-7 text-center text-sm font-bold tracking-widest text-stone-400">— 选择你的文明 —</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(Object.values(NATIONS)).map((n) => {
            const active = selected === n.id
            return (
              <button
                key={n.id}
                onClick={() => setSelected(n.id)}
                className={cn(
                  'rounded-xl border-2 p-4 text-left transition',
                  active
                    ? 'border-amber-500 bg-amber-950/40 shadow-lg shadow-amber-500/10'
                    : 'border-stone-700 bg-stone-950/50 hover:border-stone-500 hover:bg-stone-800/60',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{n.icon}</span>
                  <div>
                    <div className={cn('font-bold', active ? 'text-amber-200' : 'text-stone-200')}>{n.name}</div>
                    <div className="text-[10px] tracking-widest text-stone-500">{n.title}</div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-stone-400">{n.desc}</p>
                <ul className="mt-2 space-y-1">
                  {n.bonus.map((b) => (
                    <li key={b} className="flex items-start gap-1 text-[11px] text-emerald-300/90">
                      <span className="text-emerald-500">✦</span>{b}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {/* 局外天赋树 */}
        <TalentTree meta={meta} setMeta={setMeta} />

        <button
          onClick={() => selected && onStart(selected, meta.talents, mode, mode === 'rogue' ? seed : undefined)}
          disabled={!selected}
          className={cn(
            'mt-7 w-full rounded-xl py-4 text-lg font-black tracking-[0.3em] transition active:scale-[0.98]',
            selected
              ? mode === 'rogue'
                ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-stone-950 shadow-lg hover:from-purple-500 hover:to-purple-400'
                : 'bg-gradient-to-r from-amber-600 to-amber-500 text-stone-950 shadow-lg hover:from-amber-500 hover:to-amber-400'
              : 'cursor-not-allowed bg-stone-800 text-stone-600',
          )}
        >
          {selected
            ? mode === 'rogue'
              ? `以「${NATIONS[selected].name}」踏上无尽远征`
              : `以「${NATIONS[selected].name}」开局${meta.talents.length > 0 ? `（携带 ${meta.talents.length} 项天赋）` : ''}`
            : '请先选择文明'}
        </button>

        {onLoad && hasAnySave() && (
          <button
            onClick={() => onLoad(0)}
            className="mt-3 w-full rounded-xl border border-stone-700 bg-stone-800/60 py-3 text-sm font-bold text-stone-300 transition hover:border-stone-500 hover:bg-stone-700/60 active:scale-[0.98]"
          >
            📂 继续游戏（读取自动存档）
          </button>
        )}
      </div>
    </div>
  )
}
