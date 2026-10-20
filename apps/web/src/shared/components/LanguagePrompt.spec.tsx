import { I18nProvider } from '@lingui/react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LanguagePrompt } from './LanguagePrompt'

import { i18n, readStoredLocale } from '@/app/i18n'

const SLOW = { timeout: 4000 }

/**
 * El idioma se adivinaba —lo guardado, si no el del navegador, si no español—
 * y corregirlo exigía encontrar un interruptor pequeño al pie del login. Para
 * la gente de Georgia eso es entrar a una aplicación en español y tener que
 * buscar cómo cambiarla.
 *
 * Preguntarlo de frente solo sirve si se pregunta UNA vez: un modal en cada
 * visita es peor que no preguntar. Eso es lo que se prueba aquí.
 *
 * jsdom NO trae `localStorage`, que es justo el caso de un navegador con los
 * datos bloqueados: ahí el modal no debe aparecer, porque no podría recordar
 * la respuesta. Se simula uno para los casos que sí necesitan memoria.
 */
function simularAlmacenamiento(inicial: Record<string, string> = {}): void {
  const datos = new Map(Object.entries(inicial))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => datos.set(k, v),
    removeItem: (k: string) => datos.delete(k),
    clear: () => datos.clear(),
    key: () => null,
    length: 0,
  })
}

function renderPrompt(): void {
  render(
    <I18nProvider i18n={i18n}>
      <LanguagePrompt />
    </I18nProvider>,
  )
}

describe('la pregunta del idioma en el login', () => {
  beforeEach(() => {
    simularAlmacenamiento()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('se pregunta cuando nadie ha elegido nunca', async () => {
    renderPrompt()

    expect(await screen.findByText(/Elige tu idioma/, undefined, SLOW)).toBeVisible()
  })

  it('cada idioma se lee en el suyo, y sin banderas', async () => {
    renderPrompt()
    await screen.findByText(/Elige tu idioma/, undefined, SLOW)

    /* «Español» y «English», no «Spanish» ni «Inglés»: quien lee esto todavía
       no eligió, así que no se le puede hablar en uno de los dos (D-36). */
    expect(screen.getByRole('button', { name: /Español/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /English/ })).toBeVisible()
  })

  it('elegir lo deja guardado y cierra', async () => {
    renderPrompt()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /English/ }, SLOW))

    await waitFor(() => {
      expect(screen.queryByText(/Elige tu idioma/)).not.toBeInTheDocument()
    })
    expect(readStoredLocale()).toBe('en')
  })

  it('a quien ya eligió no se le vuelve a preguntar', async () => {
    simularAlmacenamiento({ 'oranje-locale': 'en' })

    renderPrompt()

    /* Lo que hace util la pregunta es que sea una sola vez. */
    await waitFor(
      () => {
        expect(screen.queryByText(/Elige tu idioma/)).not.toBeInTheDocument()
      },
      { timeout: 1500 },
    )
  })

  it('sin poder recordar la respuesta, no se pregunta', async () => {
    /* Ventana privada o datos del sitio bloqueados: preguntar sin poder
       guardar seria preguntar en cada carga. Queda el interruptor de siempre,
       al pie del formulario. */
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    })

    renderPrompt()

    await waitFor(
      () => {
        expect(screen.queryByText(/Elige tu idioma/)).not.toBeInTheDocument()
      },
      { timeout: 1500 },
    )
  })
})

/**
 * Lo que de verdad rompió el modal, y que ninguna prueba de arriba veía.
 *
 * `i18n.ts` llama a `activateLocale(detectLocale())` al cargarse el módulo, y
 * `activateLocale` guardaba SIEMPRE. Resultado: la app escribía la suposición
 * del arranque milisegundos antes de que el modal mirara si había preferencia,
 * así que el modal no podía salir nunca. Borrar el almacenamiento y recargar
 * tampoco servía: se volvía a escribir sola (Hugo lo cazó en staging).
 *
 * Las pruebas de arriba no lo veían porque simulan el almacenamiento DESPUÉS
 * de que ese código ya corrió. Esta mira el contrato directamente.
 */
describe('lo guardado significa «alguien lo eligió»', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('poner un idioma sin persistir no deja rastro', async () => {
    simularAlmacenamiento()
    const { activateLocale, readStoredLocale } = await import('@/app/i18n')

    activateLocale('en', { persist: false })

    /* Esto es lo que hace el arranque: adivina y aplica, pero no decide por
       nadie. Si guardara, el modal nunca tendría a quién preguntarle. */
    expect(readStoredLocale()).toBeNull()
  })

  it('elegirlo sí se guarda', async () => {
    simularAlmacenamiento()
    const { activateLocale, readStoredLocale } = await import('@/app/i18n')

    activateLocale('en')

    expect(readStoredLocale()).toBe('en')
  })
})
