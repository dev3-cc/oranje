import { useLingui } from '@lingui/react/macro'
import { Input } from '@oranje/ui'
import type { ReactNode } from 'react'

export function isCompletePhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 7
}

/** 13 dígitos alcanza a cubrir lada de país + número (p. ej. +52 1 998 123 4567). */
const MAX_PHONE_DIGITS = 13

/** Dejaba escribir dígitos sin tope: a partir del 12° ya no entran, el resto del texto (espacios, guiones) sí. */
function capDigits(raw: string): string {
  let digitCount = 0
  let result = ''
  for (const char of raw) {
    if (/\d/.test(char)) {
      if (digitCount >= MAX_PHONE_DIGITS) continue
      digitCount += 1
    }
    result += char
  }
  return result
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
        onChange(capDigits(event.target.value.replace(/[^\d\s+-]/g, '')))
      }}
      inputMode="tel"
      aria-label={label}
      placeholder={placeholder}
    />
  )
}
