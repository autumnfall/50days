import type { GameState } from '@/game/engine'

export default function EndScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const victory = state.phase === 'victory'
  return (
    <div
      className={`relative flex min-h-screen items-center justify-center px-4 ${
        victory
          ? 'bg-gradient-to-b from-amber-950/60 via-stone-950 to-stone-950'
          : 'bg-gradient-to-b from-red-950/50 via-stone-950 to-stone-950'
      }`}
    >
      <div className="w-full max-w-xl rounded-2xl border border-stone-700/60 bg-stone-900/85 p-10 text-center shadow-2xl backdrop-blur-md">
        <div className="text-7xl">{victory ? '🏆' : '💀'}</div>
        <h1 className={`mt-4 text-4xl font-black tracking-[0.3em] ${victory ? 'text-amber-200' : 'text-red-400'}`}>
          {victory ? '胜 利' : '战 败'}
        </h1>
        <p className="mt-4 leading-relaxed text-stone-300">
          {victory
            ? '第 50 天的黎明，王国的旗帜出现在地平线上。你的村庄在十波敌人的猛攻中屹立不倒——你的名字将被吟游诗人传唱！'
            : (state.defeatReason ?? '村庄陷落了……')}
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-stone-950/60 p-3">
            <div className="text-2xl font-black text-amber-300">{Math.min(state.day, 50)}</div>
            <div className="mt-1 text-xs text-stone-500">坚守天数</div>
          </div>
          <div className="rounded-lg bg-stone-950/60 p-3">
            <div className="text-2xl font-black text-stone-200">{state.villagers}</div>
            <div className="mt-1 text-xs text-stone-500">幸存村民</div>
          </div>
          <div className="rounded-lg bg-stone-950/60 p-3">
            <div className="text-2xl font-black text-red-300">
              {state.soldiers.militia + state.soldiers.archer + state.soldiers.knight}
            </div>
            <div className="mt-1 text-xs text-stone-500">幸存士兵</div>
          </div>
        </div>
        <button
          onClick={onRestart}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-4 text-lg font-black tracking-[0.3em] text-stone-950 transition hover:from-amber-500 hover:to-amber-400 active:scale-[0.98]"
        >
          再 来 一 局
        </button>
      </div>
    </div>
  )
}
