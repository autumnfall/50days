import { useState } from 'react'
import { NATIONS } from '@/game/config'
import type { SaveMetadata } from '@/game/save'
import { cn } from '@/lib/utils'

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const phaseLabel: Record<string, string> = {
  start: '选择文明',
  playing: '进行中',
  battle: '战斗中',
  dungeon_result: '地牢结算中',
  victory: '已胜利',
  defeat: '已战败',
}

interface Props {
  open: boolean
  mode: 'save' | 'load'
  metadata: (SaveMetadata | null)[]
  onClose: () => void
  onSave: (slot: number) => boolean
  onLoad: (slot: number) => boolean
  onDelete: (slot: number) => void
}

export default function SaveLoadModal({ open, mode, metadata, onClose, onSave, onLoad, onDelete }: Props) {
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null)

  if (!open) return null

  const handleClick = (slot: number, meta: SaveMetadata | null) => {
    if (mode === 'save') {
      if (meta) {
        setConfirmSlot(slot)
      } else {
        if (onSave(slot)) onClose()
      }
    } else {
      if (meta && onLoad(slot)) onClose()
    }
  }

  const handleConfirm = () => {
    if (confirmSlot !== null && onSave(confirmSlot)) {
      setConfirmSlot(null)
      onClose()
    }
  }

  const slots = [
    { slot: 0, label: '自动存档', meta: metadata[0], readonly: true },
    { slot: 1, label: '存档 1', meta: metadata[1], readonly: false },
    { slot: 2, label: '存档 2', meta: metadata[2], readonly: false },
    { slot: 3, label: '存档 3', meta: metadata[3], readonly: false },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center game-scrim bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="game-dialog max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-600 bg-stone-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-700 bg-stone-900/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-black tracking-widest text-amber-200">
            {mode === 'save' ? '💾 保存游戏' : '📂 读取存档'}
          </h2>
          <button onClick={onClose} className="rounded-lg bg-stone-800 px-3 py-1 text-sm text-stone-300 hover:bg-stone-700">✕</button>
        </div>

        {confirmSlot !== null ? (
          <div className="px-6 py-6 text-center">
            <p className="text-stone-200">确定覆盖 <b className="text-amber-300">存档 {confirmSlot}</b>？</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setConfirmSlot(null)}
                className="flex-1 rounded-lg bg-stone-800 py-2 text-sm text-stone-300 hover:bg-stone-700"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-bold text-stone-950 hover:bg-amber-500"
              >
                确定覆盖
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 px-6 py-4">
            {slots.map(({ slot, label, meta, readonly }) => {
              const canAct = mode === 'save' ? !readonly : !!meta
              return (
                <div
                  key={slot}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 transition',
                    meta
                      ? 'border-stone-700 bg-stone-800/60 hover:border-stone-500'
                      : 'border-stone-800 bg-stone-950/40',
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-950/60 text-lg">
                    {slot === 0 ? '⏰' : '💾'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-stone-200">{label}</div>
                    {meta ? (
                      <div className="mt-0.5 text-xs text-stone-400">
                        {meta.nation && <span>{NATIONS[meta.nation].icon} {NATIONS[meta.nation].name} · </span>}
                        {meta.timestamp ? `第 ${meta.day} 天 · ${phaseLabel[meta.phase]} · ${formatTime(meta.timestamp)}` : '存档信息缺失'}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs text-stone-600">空</div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {meta && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(slot) }}
                        className="rounded-lg bg-red-950/60 px-2.5 py-1.5 text-xs text-red-400 transition hover:bg-red-900/60"
                        title="删除存档"
                      >
                        🗑
                      </button>
                    )}
                    <button
                      onClick={() => handleClick(slot, meta)}
                      disabled={!canAct}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-bold transition',
                        canAct
                          ? mode === 'save'
                            ? 'bg-amber-600 text-stone-950 hover:bg-amber-500'
                            : 'bg-emerald-600 text-stone-950 hover:bg-emerald-500'
                          : 'cursor-not-allowed bg-stone-800 text-stone-600',
                      )}
                    >
                      {mode === 'save' ? (meta ? '覆盖' : '保存') : '读取'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
