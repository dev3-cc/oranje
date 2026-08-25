import { cn } from '@oranje/ui'
import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react'

import { Select } from './Select'

export const SELECT_FIELD_CLASS =
  'h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-ink-4 focus:outline-none focus-visible:border-o-500 focus-visible:ring-2 focus-visible:ring-o-500/30 disabled:bg-surface-2 disabled:text-ink-3'

export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }
>(function SelectField({ className, children, ...props }, ref) {
  return (
    <Select ref={ref} className={cn(SELECT_FIELD_CLASS, className)} {...props}>
      {children}
    </Select>
  )
})
