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
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const tooltipRef = useRef<HTMLDivElement>(null)
  const lastTouchY = useRef<number | null>(null)
  const retryRef = useRef<number>(0)

  const findTarget = (): Element | null => {
    if (!current.target) return null
    const els = document.querySelectorAll(current.target)
    return [...els].find((e) => e.getClientRects().length > 0) ?? null
  }

  const updatePos = () => {
    const el = findTarget()
    if (!el) {
      // 目标可能还未渲染（如 Tab 切换动画），最多重试几次
      if (retryRef.current < 5) {
        retryRef.current += 1
        window.requestAnimationFrame(updatePos)
      } else {
        setTargetPos(null)
      }
      return
    }
    retryRef.current = 0
    // 移动端面板通常较高，优先把目标顶部露出来，便于用户向下滚动查看完整内容
    const isMobile = window.innerWidth < 1024
    el.scrollIntoView({ block: isMobile ? 'start' : 'center', behavior: 'smooth' })
    // 移动端有固定 Header（h-14 = 56px），需要额外往下滚动一点，避免目标被 Header 遮住
    if (isMobile) {
      window.scrollBy({ top: -64, behavior: 'auto' })
    }
    const r = el.getBoundingClientRect()
    setTargetPos({ top: r.top, left: r.left, width: r.width, height: r.height })
  }

  // 切换步骤时先清空旧位置，避免一闪而过的旧 tooltip
  useLayoutEffect(() => {
    retryRef.current = 0
    setTargetPos(null)
    setTooltipStyle({})
    updatePos()
  }, [step, current.target])

  useEffect(() => {
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => { window.removeEventListener('resize', updatePos); window.removeEventListener('scroll', updatePos, true) }
  }, [step])

  // 根据目标位置和提示卡实际尺寸，计算安全的绝对定位（确保不溢出视口）
  useLayoutEffect(() => {
    if (!targetPos) { setTooltipStyle({}); return }
    const tooltip = tooltipRef.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    const isMobile = vw < 1024
    const gap = 12
    const padding = 8

    let p = current.placement ?? 'bottom'
    // 窄屏上左/右放置必然溢出：按目标在屏幕的上/下半部改为下方/上方
    if (isMobile && (p === 'left' || p === 'right')) {
      p = targetPos.top + targetPos.height / 2 < vh / 2 ? 'bottom' : 'top'
    }

    const place = (): { top: number; left: number; transform: string } => {
      const centerX = targetPos.left + targetPos.width / 2
      const clampedX = Math.min(Math.max(centerX, 176), Math.max(176, vw - 176))
      switch (p) {
        case 'bottom': return { top: targetPos.top + targetPos.height + gap, left: clampedX, transform: 'translateX(-50%)' }
        case 'top': return { top: targetPos.top - gap, left: clampedX, transform: 'translate(-50%, -100%)' }
        case 'right': return { top: targetPos.top + targetPos.height / 2, left: targetPos.left + targetPos.width + gap, transform: 'translateY(-50%)' }
        case 'left': return { top: targetPos.top + targetPos.height / 2, left: targetPos.left - gap, transform: 'translate(-100%, -50%)' }
      }
    }

    const initial = place()
    if (!tooltip) { setTooltipStyle(initial); return }

    const rect = tooltip.getBoundingClientRect()
    let top = initial.top
    let left = initial.left

    // 垂直方向：若溢出则翻转；翻转后仍溢出则钳制到安全区域
    if (top < padding) {
      if (p === 'top') {
        top = targetPos.top + targetPos.height + gap
      }
      top = Math.max(padding, top)
    }
    if (top + rect.height > vh - padding) {
      if (p === 'bottom') {
        top = targetPos.top - gap - rect.height
      }
      top = Math.min(top, vh - padding - rect.height)
    }

    // 水平方向钳制
    if (left - rect.width / 2 < padding) {
      left = padding + rect.width / 2
    }
    if (left + rect.width / 2 > vw - padding) {
      left = vw - padding - rect.width / 2
    }

    setTooltipStyle({ top, left, transform: initial.transform })
  }, [targetPos, current.placement])

  // 将覆盖层上的滚动/滑动事件转发给底层页面，让用户在教程期间仍能上下滚动查看面板内容
  const onWheel = (e: React.WheelEvent) => {
    window.scrollBy({ top: e.deltaY, behavior: 'auto' })
  }
  const onTouchStart = (e: React.TouchEvent) => {
    lastTouchY.current = e.touches[0].clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (lastTouchY.current !== null) {
      const delta = lastTouchY.current - touch.clientY
      window.scrollBy({ top: delta, behavior: 'auto' })
    }
    lastTouchY.current = touch.clientY
  }
  const onTouchEnd = () => { lastTouchY.current = null }

  const isFirst = step === 0
  const isLast = step === TUTORIAL_STEPS.length - 1
  const isCentered = !targetPos

  return (
    <div
      className="fixed inset-0 z-[60]"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
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
          'pointer-events-auto absolute z-10 flex max-h-[80vh] w-[340px] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-amber-600/40 bg-stone-900/95 p-5 shadow-2xl backdrop-blur-sm',
          isCentered && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        )}
      >
        <h3 className="text-base font-black text-amber-200">{current.title}</h3>
        <p className="mt-2 overflow-y-auto text-sm leading-relaxed text-stone-300">{current.content}</p>

        <div className="mt-4 flex items-center justify-between pt-2">
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
