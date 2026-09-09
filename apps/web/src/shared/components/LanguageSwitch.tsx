import { useLingui } from '@lingui/react'
import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import { activateLocale, LOCALE_LABEL, LOCALES, type Locale } from '@/app/i18n'

/**
 * El interruptor de idioma (D-36, Convenciones de Diseño · Idioma): un control
 * segmentado «Español · English», cada idioma escrito en su propio idioma y
 * SIN banderas — una bandera es un país, no un idioma. Vive junto a la cuenta
 * (login, tarjeta de perfil del sidebar, menú del Colaborador), nunca en la
 * navegación principal. El cambio es inmediato; `onChange` es para quien
 * además quiera guardarlo en la persona.
 */
export function LanguageSwitch({
  onChange,
  size = 'md',
  className,
}: {
  onChange?: (locale: Locale) => void
  size?: 'sm' | 'md'
  className?: string
}): ReactNode {
  const { i18n } = useLingui()
  const active = i18n.locale

  return (
    <div
      role="group"
      aria-label="Idioma / Language"
      className={cn('flex w-fit gap-0.5 rounded-lg bg-surface-2 p-0.5', className)}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={active === locale}
          onClick={() => {
            if (active === locale) return
            activateLocale(locale)
            onChange?.(locale)
          }}
          className={cn(
            'flex-1 cursor-pointer rounded-md text-center transition-colors',
            size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
            /* Mismo tinte activo que FilterSelect (o-50/o-700): `bg-surface`
               sobre `bg-surface-2` casi no se distinguía (#fff vs #fbfaf8,
               solo una sombra sutil los separaba). */
            active === locale
              ? 'bg-o-50 font-semibold text-o-700 shadow-sm'
              : 'text-ink-3 hover:text-ink',
          )}
        >
          {LOCALE_LABEL[locale]}
        </button>
      ))}
    </div>
  )
}
