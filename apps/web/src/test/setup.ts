import '@testing-library/jest-dom/vitest'

/**
 * Lo que jsdom no implementa y las primitivas de Radix (shadcn) sí usan.
 * Stubs inertes: los specs no miden layout, solo estructura y valores aria.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

/**
 * Radix Select los llama al abrir el desplegable. Se parcha el prototipo de
 * jsdom directamente — la regla de métodos sueltos no aplica a un polyfill.
 */
/* eslint-disable @typescript-eslint/unbound-method */
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => undefined
Element.prototype.releasePointerCapture ??= () => undefined
Element.prototype.scrollIntoView ??= () => undefined
/* eslint-enable @typescript-eslint/unbound-method */
