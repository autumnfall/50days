import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { RESOURCE_INFO, type ResourceId } from '@/game/config'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { RESOURCE_ICONS } from './icons'

/** 资源花费标签 */
export function CostTag({ cost, resources }: { cost: Partial<Record<ResourceId, number>>; resources: Record<ResourceId, number> }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {(Object.entries(cost) as [ResourceId, number][]).map(([r, v]) => {
        const enough = resources[r] >= v
        const ResourceIcon = RESOURCE_ICONS[r]
        return (
          <span key={r} className={cn('inline-flex items-center gap-0.5 text-xs font-medium', enough ? 'text-stone-300' : 'text-red-400')}>
            <ResourceIcon size={13} aria-hidden="true" />
            <span className="sr-only">{RESOURCE_INFO[r].name}</span>
            <span>{v}</span>
          </span>
        )
      })}
    </span>
  )
}

/** 面板容器 */
export function Panel({ title, icon: Icon, children, className, extra, ...rest }: {
  title: string
  icon: LucideIcon
  children: ReactNode
  className?: string
  extra?: ReactNode
} & React.HTMLAttributes<HTMLElement>) {
  return (
    // 不用 backdrop-blur：常驻面板上的背景模糊在 Chromium 下会触发合成层重绘故障，
    // 切换/滚动时面板内容偶发整块不显示、待下次重绘才恢复；改用更高不透明度背景补偿
    <section className={cn('game-panel', className)} {...rest}>
      <header className="game-panel-heading flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3.5 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-amber-100">
          <span className="panel-emblem"><Icon size={15} aria-hidden="true" /></span>
          {title}
        </h2>
        {extra}
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}

/** 移动端可点击展开的提示；桌面端仍使用原生 title 悬停。
 *  弹出层通过 Portal 挂载到 body——否则祖先的 backdrop-blur/transform 会把
 *  fixed 定位限制在祖先内，导致遮罩与关闭按钮错位、无法关闭。 */
export function MobileTooltip({ content, children, className }: {
  content: string
  children: ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (!isMobile) {
    return (
      <span className={className} title={content}>
        {children}
      </span>
    )
  }

  return (
    <>
      <span
        className={cn('cursor-pointer', className)}
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
      >
        {children}
      </span>
      {open && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center game-scrim bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="game-dialog relative w-full max-w-xs rounded-xl border border-stone-600 bg-stone-900 p-4 text-sm leading-relaxed text-stone-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-stone-700 text-sm text-stone-200 shadow-md active:scale-90"
              aria-label="关闭"
            >
              ✕
            </button>
            <div className="whitespace-pre-line pr-9">{content}</div>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-lg bg-stone-700 py-2 text-sm font-bold text-stone-100 transition active:scale-[0.98]"
            >
              关闭
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
