import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * Primitiva de shadcn/ui, copiada al repo (D-16) y adaptada a los tokens
 * Oranje: `bg-surface-3/60` en vez del `bg-accent` de shadcn. Conserva el
 * `kebab-case` de `components/ui/` para no romper `shadcn diff`.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-md bg-surface-3/60', className)}
      {...props}
    />
  )
}
