import { cn, MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

export function FilterSelect({
  label,
  anyLabel,
  value,
  anyValue = 'ALL',
  options,
  onChange,
  icon,
}: {
  label: string
  anyLabel: string
  value: string
  anyValue?: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  icon?: string
}): ReactNode {
  const isActive = value !== anyValue

  return (
    <span className="relative inline-block">
      {icon && (
        <MaterialIcon
          name={icon}
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base',
            isActive ? 'text-o-700' : 'text-ink-3',
          )}
        />
      )}
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        aria-label={label}
        className={cn(
          'cursor-pointer appearance-none rounded-full border py-2.5 pr-9 text-sm transition-colors focus:border-o-500 focus:outline-none',
          icon ? 'pl-9' : 'pl-4',
          isActive
            ? 'border-o-500 bg-o-50 font-semibold text-o-700'
            : 'border-line bg-surface text-ink hover:bg-surface-2',
        )}
      >
        <option value={anyValue}>
          {label}: {anyLabel}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {label}: {option.label}
          </option>
        ))}
      </select>
      <MaterialIcon
        name="expand_more"
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-base',
          isActive ? 'text-o-700' : 'text-ink-3',
        )}
      />
    </span>
  )
}
