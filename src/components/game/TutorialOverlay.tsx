import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TUTORIAL_STEPS, type TutorialStep } from '@/game/tutorial'
import { cn } from '@/lib/utils'

interface Pos { top: number; left: number; width: number; height: number }

export default function TutorialOverlay({
  step,
  onNext,
  onPrev,
  onSkip,
}: {
  step: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}) {
  const current: TutorialStep = TUTORIAL_STEPS[step]
  const [targetPos, setTargetPos] = useState<Pos | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const updatePos = () => {
    if (!current.target) { setTargetPos(null); return }
    // 桌面/移动双布局下同一 data-tutorial 可能出现多次，取第一个可见元素
    const els = document.querySelectorAll(current.target)
    const el = [...els].find((e) => e.getClientRects().length > 0)
    if (!el) { setTargetPos(null); return }
    // 目标可能不在可视区内（移动端长页面），先滚动到中间再定位
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    setTargetPos({ top: r.top, left: r.left, width: r.width, height: r.height })
  }

  useLayoutEffect(() => { updatePos() }, [step, current.target])
  useEffect(() => {
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => { window.removeEventListener('resize', updatePos); window.removeEventListener('scroll', updatePos, true) }
  }, [step])

  const isFirst = step === 0
  const isLast = step === TUTORIAL_STEPS.length - 1
  const isCentered = !targetPos

  const tooltipStyle: React.CSSProperties = isCentered
    ? {}
    : (() => {
        const vw = window.innerWidth
        const vh = window.innerHeight
        const isMobile = vw < 1024
        let p = current.placement ?? 'bottom'
        // 窄屏上左/右放置必然溢出：按目标在屏幕的上/下半部改为下方/上方
        if (isMobile && (p === 'left' || p === 'right')) {
          p = targetPos!.top + targetPos!.height / 2 < vh / 2 ? 'bottom' : 'top'
        }
        const gap = 12
        // 水平方向钳制在屏幕内（卡片宽 340，预留两侧各 8px）
        const centerX = targetPos!.left + targetPos!.width / 2
        const clampedX = Math.min(Math.max(centerX, 176), Math.max(176, vw - 176))
        switch (p) {
          case 'bottom': return { top: targetPos!.top + targetPos!.height + gap, left: clampedX, transform: 'translateX(-50%)' }
          case 'top': return { top: targetPos!.top - gap, left: clampedX, transform: 'translate(-50%, -100%)' }
          case 'right': return { top: targetPos!.top + targetPos!.height / 2, left: targetPos!.left + targetPos!.width + gap, transform: 'translateY(-50%)' }
          case 'left': return { top: targetPos!.top + targetPos!.height / 2, left: targetPos!.left - gap, transform: 'translate(-100%, -50%)' }
        }
      })()

  return (
    <div className="fixed inset-0 z-[60]">
      {/* 透明全屏拦截层：阻止底层所有点击 */}
      <div className="absolute inset-0" />

      {/* 有目标时：用 box-shadow 同时实现遮罩+切口 */}
      {targetPos && (
        <div
          className="absolute rounded-xl"
          style={{
            top: targetPos.top - 6,
            left: targetPos.left - 6,
            width: targetPos.width + 12,
            height: targetPos.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.75), 0 0 20px 4px rgba(245,158,11,0.5), inset 0 0 20px 4px rgba(245,158,11,0.15)',
          }}
        />
      )}

      {/* 无目标时（居中步骤）：用普通遮罩 */}
      {!targetPos && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
      )}

      {/* 提示卡片 */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        className={cn(
          'pointer-events-auto absolute z-10 w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-amber-600/40 bg-stone-900/95 p-5 shadow-2xl backdrop-blur-sm',
          isCentered && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        )}
      >
        <h3 className="text-base font-black text-amber-200">{current.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-stone-300">{current.content}</p>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-xs text-stone-500 transition hover:text-stone-300"
          >
            跳过教程
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-600">{step + 1}/{TUTORIAL_STEPS.length}</span>
            {!isFirst && (
              <button
                onClick={onPrev}
                className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs text-stone-300 transition hover:bg-stone-700"
              >
                上一步
              </button>
            )}
            <button
              onClick={onNext}
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-stone-950 transition hover:bg-amber-500"
            >
              {isLast ? '开始游戏' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
