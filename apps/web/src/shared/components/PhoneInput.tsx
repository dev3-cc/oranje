import { useLingui } from '@lingui/react/macro'
import { Input } from '@oranje/ui'
import type { ReactNode } from 'react'

export function isCompletePhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 7
}

export function PhoneInput({
  value,
  onChange,
  ariaLabel,
  placeholder = '998 123 4567',
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  placeholder?: string
}): ReactNode {
  const { t } = useLingui()
  const label = ariaLabel ?? t`Teléfono`
  return (
    <Input
      value={value}
      onChange={(event) => {
        onChange(event.target.value.replace(/[^\d\s+-]/g, ''))
      }}
      inputMode="tel"
      aria-label={label}
      placeholder={placeholder}
    />
  )
}
