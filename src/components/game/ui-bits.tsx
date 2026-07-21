import type { ReactNode } from 'react'
import { RESOURCE_INFO, type ResourceId } from '@/game/config'
import { cn } from '@/lib/utils'

/** 资源花费标签 */
export function CostTag({ cost, resources }: { cost: Partial<Record<ResourceId, number>>; resources: Record<ResourceId, number> }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {(Object.entries(cost) as [ResourceId, number][]).map(([r, v]) => {
        const enough = resources[r] >= v
        return (
          <span key={r} className={cn('inline-flex items-center gap-0.5 text-xs font-medium', enough ? 'text-stone-300' : 'text-red-400')}>
            <span>{RESOURCE_INFO[r].icon}</span>
            <span>{v}</span>
          </span>
        )
      })}
    </span>
  )
}

/** 面板容器 */
export function Panel({ title, icon, children, className, extra }: {
  title: string
  icon: string
  children: ReactNode
  className?: string
  extra?: ReactNode
}) {
  return (
    <section className={cn('rounded-xl border border-stone-700/60 bg-stone-900/70 backdrop-blur-sm shadow-lg', className)}>
      <header className="flex items-center justify-between gap-2 border-b border-stone-700/60 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-stone-200">
          <span className="text-base">{icon}</span>
          {title}
        </h2>
        {extra}
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}
