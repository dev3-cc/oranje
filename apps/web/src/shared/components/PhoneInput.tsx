import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Teléfono con lada de país automática. Solo los dos países donde Oranje
 * opera (los mismos del autocompletado de Places: EE. UU. y el arranque en
 * México); el valor compuesto viaja como un solo string (`+52 998 123 4567`)
 * porque el contrato guarda `phone` como texto libre.
 */
export const COUNTRY_CODES = [
  { code: '+1', label: '+1 · EE. UU.' },
  { code: '+52', label: '+52 · México' },
] as const

const DEFAULT_CODE = '+1'

/** Parte el valor guardado en lada + número nacional (para pintar el control). */
function splitPhone(value: string): { code: string; national: string } {
  for (const { code } of COUNTRY_CODES) {
    if (value.startsWith(code)) return { code, national: value.slice(code.length).trimStart() }
  }
  return { code: DEFAULT_CODE, national: value.replace(/^\+/, '') }
}

function composePhone(code: string, national: string): string {
  return national === '' ? '' : `${code} ${national}`
}

/** Completo = el número nacional (sin la lada) tiene al menos 7 dígitos. */
export function isCompletePhone(value: string): boolean {
  return splitPhone(value).national.replace(/\D/g, '').length >= 7
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
  const { code, national } = splitPhone(value)

  return (
    <span className="flex w-full">
      <span className="relative shrink-0">
        <select
          value={code}
          onChange={(event) => {
            onChange(composePhone(event.target.value, national))
          }}
          aria-label={`Lada de país de ${ariaLabel.toLowerCase()}`}
          className="h-full cursor-pointer appearance-none rounded-l-md border border-r-0 border-line bg-surface-2 py-2.5 pr-7 pl-3 text-sm text-ink-2 focus:border-o-500 focus:outline-none"
        >
          {COUNTRY_CODES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>
        <MaterialIcon
          name="expand_more"
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-sm text-ink-3"
        />
      </span>
      <input
        value={national}
        onChange={(event) => {
          /** Solo dígitos, espacios y guiones: la lada ya la pone el selector. */
          onChange(composePhone(code, event.target.value.replace(/[^\d\s-]/g, '')))
        }}
        inputMode="tel"
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="w-full rounded-r-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
      />
    </span>
  )
}
