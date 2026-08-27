import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

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
