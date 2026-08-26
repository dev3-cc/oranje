import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

export function StepIndicator({
  steps,
  current,
  onStepClick,
}: {
  steps: ReadonlyArray<{ step: number; label: string }>
  current: number
  onStepClick: (step: number) => void
}): ReactNode {
  return (
    <ol className="flex items-center gap-2">
      {steps.map(({ step, label }, index) => {
        const isDone = step < current
        const isActive = step === current
        return (
          <li key={step} className="flex items-center gap-2">
            {index > 0 && <span className="h-px w-4 bg-line" aria-hidden />}
            <button
              type="button"
              disabled={!isDone}
              onClick={() => {
                onStepClick(step)
              }}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm transition-colors',
                isDone && 'cursor-pointer hover:bg-surface-2',
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                  isActive && 'bg-o-500 text-ink',
                  isDone && 'bg-green text-white',
                  !isActive && !isDone && 'border border-line text-ink-3',
                )}
              >
                {isDone ? (
                  <span className="material-icons-outlined text-sm leading-none" aria-hidden>
                    check
                  </span>
                ) : (
                  step
                )}
              </span>
              <span
                className={cn('whitespace-nowrap', isActive ? 'font-semibold text-ink' : 'hidden')}
              >
                {label}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
