import '@testing-library/jest-dom/vitest'
import { I18nProvider } from '@lingui/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { beforeEach, vi } from 'vitest'

import { activateLocale, i18n } from '@/app/i18n'

/**
 * Los intros «una sola vez» (useIntroSeen) persisten su visto en
 * localStorage: sin limpiarlo, el primer test que pasa un intro se lo
 * esconde a los siguientes y los specs dejan de ser deterministas.
 */
beforeEach(() => {
  try {
    window.localStorage.clear()
  } catch {
    /* Este jsdom no trae storage: los intros son fail-open y no lo necesitan. */
  }
})

/**
 * jsdom se presenta como navegador en inglés y D-36 detecta el idioma del
 * navegador: sin esto los specs verían la app en inglés. Los textos de los
 * specs son la fuente en español; un spec de inglés activa 'en' a mano.
 */
beforeEach(() => {
  activateLocale('es')
})

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

/* eslint-disable @typescript-eslint/unbound-method */
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => undefined
Element.prototype.releasePointerCapture ??= () => undefined
Element.prototype.scrollIntoView ??= () => undefined
/* eslint-enable @typescript-eslint/unbound-method */

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })
}

/**
 * D-36: toda pantalla lee el idioma del `I18nProvider`. En vez de envolver
 * cada uno de los specs, `render` lo monta solo — y respeta el `wrapper` que
 * un spec ya traiga, anidándolo dentro.
 */
vi.mock('@testing-library/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@testing-library/react')>()
  type RenderOptions = NonNullable<Parameters<typeof actual.render>[1]>
  const withI18n = (Inner?: RenderOptions['wrapper']) =>
    function I18nWrapper({ children }: { children: ReactNode }): ReactNode {
      const content = Inner ? createElement(Inner, null, children) : children
      return createElement(I18nProvider, { i18n }, content)
    }
  return {
    ...actual,
    render: (ui: Parameters<typeof actual.render>[0], options?: RenderOptions) =>
      actual.render(ui, { ...options, wrapper: withI18n(options?.wrapper) }),
  }
})
