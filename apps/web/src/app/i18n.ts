import { i18n } from '@lingui/core'

import { messages as en } from '../locales/en/messages.po'
import { messages as es } from '../locales/es/messages.po'

/**
 * D-36: la interfaz habla el idioma de la persona. El español es la fuente
 * (los textos viven literales en los componentes); el inglés se redacta en el
 * catálogo. La preferencia vive en dos lugares a propósito: el navegador
 * (inmediato, sirve en el login) y la persona (`identity.user.locale`, la
 * sigue entre dispositivos). Al iniciar sesión gana la de la persona.
 */
export const LOCALES = ['es', 'en'] as const
export type Locale = (typeof LOCALES)[number]

const STORAGE_KEY = 'oranje-locale'

/** Etiqueta de cada idioma, EN su propio idioma (nunca se traduce). */
export const LOCALE_LABEL: Record<Locale, string> = { es: 'Español', en: 'English' }

/** Para `Intl`: fechas, horas y números con el locale activo. */
const INTL_TAG: Record<Locale, string> = { es: 'es-MX', en: 'en-US' }

export function isLocale(value: unknown): value is Locale {
  return value === 'es' || value === 'en'
}

export function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isLocale(stored) ? stored : null
  } catch {
    return null
  }
}

/** Guardado del navegador → idioma del navegador → español. */
export function detectLocale(): Locale {
  const stored = readStoredLocale()
  if (stored) return stored
  const browser = typeof navigator === 'undefined' ? '' : (navigator.language ?? '')
  return browser.toLowerCase().startsWith('en') ? 'en' : 'es'
}

i18n.load({ es, en })

export function currentLocale(): Locale {
  return isLocale(i18n.locale) ? i18n.locale : 'es'
}

export function localeTag(): string {
  return INTL_TAG[currentLocale()]
}

export function activateLocale(locale: Locale): void {
  if (i18n.locale !== locale) i18n.activate(locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* Sin storage (modo privado, captura): el cambio vive lo que dure la pestaña. */
  }
}

activateLocale(detectLocale())

export { i18n }
