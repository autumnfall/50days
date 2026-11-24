import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TUTORIAL_STEPS, type TutorialStep } from '@/game/tutorial'
import { cn } from '@/lib/utils'

interface Pos { top: number; left: number; width: number; height: number }

/** 取当前可视视口尺寸（优先 visualViewport，适配地址栏动态显隐） */
function getViewport(): { width: number; height: number } {
  const vv = window.visualViewport
  if (vv) {
    return { width: vv.width, height: vv.height }
  }
  return { width: window.innerWidth, height: window.innerHeight }
}

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

  const findTarget = useCallback((): Element | null => {
    if (!current.target) return null
    const els = document.querySelectorAll(current.target)
    return [...els].find((e) => e.getClientRects().length > 0) ?? null
  }, [current.target])

  /** 仅测量目标位置（用于 resize / scroll，不再触发滚动） */
  const measureTarget = useCallback(() => {
    const el = findTarget()
    if (!el) {
      setTargetPos(null)
      return
    }
    const r = el.getBoundingClientRect()
    setTargetPos({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [findTarget])

  useLayoutEffect(() => {
    setTargetPos(null)
    setTooltipStyle({})
    if (!current.target) return

    let frame = 0
    let attempts = 0
    const scrollAndMeasure = () => {
      const el = findTarget()
      if (!el) {
        if (++attempts <= 5) frame = requestAnimationFrame(scrollAndMeasure)
        return
      }
      const mobile = getViewport().width < 1024
      el.scrollIntoView({ block: mobile ? 'start' : 'center', behavior: 'instant' })
      if (mobile) window.scrollBy({ top: -64, behavior: 'auto' })
      measureTarget()
    }
    frame = requestAnimationFrame(scrollAndMeasure)
    return () => cancelAnimationFrame(frame)
  }, [step, current.target, findTarget, measureTarget])

  useEffect(() => {
    const vv = window.visualViewport
    const onResize = () => measureTarget()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    vv?.addEventListener('resize', onResize)
    vv?.addEventListener('scroll', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
      vv?.removeEventListener('resize', onResize)
      vv?.removeEventListener('scroll', onResize)
    }
  }, [measureTarget])

  // 根据目标位置和提示卡实际尺寸，计算安全的绝对定位（确保不溢出视口）
  useLayoutEffect(() => {
    if (!targetPos) { setTooltipStyle({}); return }
    const tooltip = tooltipRef.current
    const { width: vw, height: vh } = getViewport()
    const isMobile = vw < 1024
    const gap = 12
    const padding = 8
    const headerRoom = isMobile ? 64 : 8 // 移动端给固定 Header 留空间

    // 估算 tooltip 尺寸（未渲染时按默认宽度给初值，随后会重算）
    const estimateRect = (): { width: number; height: number } => {
      if (tooltip) return tooltip.getBoundingClientRect()
      return { width: Math.min(340, vw - 2 * padding), height: 120 }
    }

    let p = current.placement ?? 'bottom'
    // 窄屏上左/右放置必然溢出：按目标在屏幕的上/下半部改为下方/上方
    if (isMobile && (p === 'left' || p === 'right')) {
      p = targetPos.top + targetPos.height / 2 < vh / 2 ? 'bottom' : 'top'
    }

    // 移动端目标过高时，放弃贴边，改用顶部横幅式提示，确保内容完整可见
    const targetTooTall = isMobile && targetPos.height > vh * 0.5

    const clampCenterX = (centerX: number, rectW: number): number => {
      const half = rectW / 2
      return Math.min(Math.max(centerX, padding + half), Math.max(padding + half, vw - padding - half))
    }

    const place = (rectW: number): { top: number; left: number; transform: string } => {
      const centerX = clampCenterX(targetPos.left + targetPos.width / 2, rectW)
      if (targetTooTall) {
        return { top: headerRoom + padding, left: vw / 2, transform: 'translateX(-50%)' }
      }
      switch (p) {
        case 'bottom': return { top: targetPos.top + targetPos.height + gap, left: centerX, transform: 'translateX(-50%)' }
        case 'top': return { top: targetPos.top - gap, left: centerX, transform: 'translate(-50%, -100%)' }
        case 'right': return { top: targetPos.top + targetPos.height / 2, left: targetPos.left + targetPos.width + gap, transform: 'translateY(-50%)' }
        case 'left': return { top: targetPos.top + targetPos.height / 2, left: targetPos.left - gap, transform: 'translate(-100%, -50%)' }
      }
    }

    const rect = estimateRect()
    const initial = place(rect.width)
    let top = initial.top
    let left = initial.left
    let transform = initial.transform

    // 根据 transform 计算 tooltip 实际占用的垂直区间
    const getVerticalSpan = (t: string, y: number): [number, number] => {
      if (t.includes('translateY(-100%)') || (t.includes('-100%') && t.includes('translate') && !t.includes('translateX'))) {
        return [y - rect.height, y]
      }
      return [y, y + rect.height]
    }

    let [spanTop, spanBottom] = getVerticalSpan(transform, top)

    // 垂直方向：若溢出则翻转；翻转后仍溢出则钳制到安全区域
    if (spanTop < headerRoom + padding) {
      if (!targetTooTall && (p === 'top' || transform.includes('-100%'))) {
        top = targetPos.top + targetPos.height + gap
        transform = 'translateX(-50%)'
      }
      [spanTop, spanBottom] = getVerticalSpan(transform, top)
      if (spanTop < headerRoom + padding) {
        top = headerRoom + padding + (transform.includes('-100%') ? rect.height : 0)
      }
    }
    if (spanBottom > vh - padding) {
      if (!targetTooTall && (p === 'bottom' || !transform.includes('-100%'))) {
        top = targetPos.top - gap
        transform = 'translate(-50%, -100%)'
      }
      [spanTop, spanBottom] = getVerticalSpan(transform, top)
      if (spanBottom > vh - padding) {
        top = vh - padding - (transform.includes('-100%') ? 0 : rect.height)
      }
    }

    // 水平方向钳制
    const halfW = rect.width / 2
    if (transform.includes('translateX(-50%)')) {
      if (left - halfW < padding) left = padding + halfW
      if (left + halfW > vw - padding) left = vw - padding - halfW
    } else if (transform.includes('translate(-100%')) {
      if (left - rect.width < padding) left = padding + rect.width
    } else if (transform.includes('translateY(-50%)')) {
      if (left + rect.width > vw - padding) {
        left = targetPos.left - gap - rect.width
        transform = 'translate(-100%, -50%)'
        if (left - rect.width < padding) {
          left = vw / 2
          transform = 'translateX(-50%)'
        }
      }
    }

    setTooltipStyle({ top, left, transform })
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
      className="fixed inset-x-0 top-0 z-[60] h-dvh"
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
          'pointer-events-auto absolute z-10 flex max-h-[70dvh] w-[340px] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-amber-600/40 bg-stone-900/95 p-5 shadow-2xl backdrop-blur-sm',
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
