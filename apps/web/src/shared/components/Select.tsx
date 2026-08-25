import { cn } from '@oranje/ui'
import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react'

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }
>(function Select({ children, className, ...props }, ref) {
  return (
    <span className="relative block w-full">
      <select
        ref={ref}
        {...props}
        className={cn(
          className,
          'w-full cursor-pointer appearance-none pr-9 disabled:cursor-not-allowed',
        )}
      >
        {children}
      </select>
      {}
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
})
