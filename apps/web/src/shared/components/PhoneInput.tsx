import type { ReactNode } from 'react'

export function isCompletePhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 7
}

export function PhoneInput({
  value,
  onChange,
  ariaLabel = 'Teléfono',
  placeholder = '998 123 4567',
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  placeholder?: string
}): ReactNode {
  return (
    <input
      value={value}
      onChange={(event) => {
        onChange(event.target.value.replace(/[^\d\s+-]/g, ''))
      }}
      inputMode="tel"
      aria-label={ariaLabel}
      placeholder={placeholder}
      className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-4 hover:border-ink-4 focus:outline-none focus-visible:border-o-500 focus-visible:ring-2 focus-visible:ring-o-500/30"
    />
  )
}
