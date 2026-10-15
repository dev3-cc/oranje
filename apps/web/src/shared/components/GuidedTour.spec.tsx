import { I18nProvider } from '@lingui/react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { GuidedTour, type TourStep } from './GuidedTour'

import { i18n } from '@/app/i18n'
import personaje from '@/assets/ilustrations/personaje-manager.svg'

const SLOW = { timeout: 4000 }

const PASOS: readonly TourStep[] = [
  { anchor: 'uno', title: 'El primero', description: 'Aquí se pide personal.' },
  { anchor: 'dos', title: 'El segundo', description: 'Aquí se firma.' },
  { anchor: 'fantasma', title: 'El que no está', description: 'No debería salir.' },
]

/**
 * El recorrido se arma contra el DOM real, así que lo que importa probar es
 * que no apunte al vacío: los tres roles del hotel ven controles distintos y
 * un paso fijo sobre un botón que no se dibuja dejaría el recorrido señalando
 * la nada.
 *
 * Este jsdom NO trae `localStorage`, que es justo el caso de un navegador con
 * datos bloqueados: el recorrido no debe arrancar solo ahí —se abriría en cada
 * carga— pero el botón de la pantalla sí debe poder abrirlo. Las dos cosas se
 * prueban abajo.
 */
function Anfitriona({
  children,
  steps = PASOS,
}: {
  children: ReactNode
  steps?: readonly TourStep[]
}): ReactNode {
  const [start, setStart] = useState<() => void>(() => () => undefined)
  return (
    <I18nProvider i18n={i18n}>
      <div>
        {children}
        <button type="button" onClick={start}>
          Ver el recorrido
        </button>
        <GuidedTour
          storageKey="prueba-tour"
          steps={steps}
          character={personaje}
          onReady={(fn) => {
            setStart(() => fn)
          }}
        />
      </div>
    </I18nProvider>
  )
}

async function abrirRecorrido(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Ver el recorrido' }))
}

describe('el recorrido guiado', () => {
  it('no arranca solo cuando no se puede recordar que ya se vio', async () => {
    render(
      <Anfitriona>
        <button data-tour="uno">Crear requisición</button>
      </Anfitriona>,
    )

    /* Sin storage sería un recorrido en cada carga: se queda callado. */
    await waitFor(
      () => {
        expect(screen.queryByText('El primero')).not.toBeInTheDocument()
      },
      { timeout: 1500 },
    )
  })

  it('el botón de la pantalla lo abre, y empieza por el primer control', async () => {
    render(
      <Anfitriona>
        <button data-tour="uno">Crear requisición</button>
        <button data-tour="dos">Autorizar</button>
      </Anfitriona>,
    )
    const user = userEvent.setup()
    await abrirRecorrido(user)

    expect(await screen.findByText('El primero', undefined, SLOW)).toBeVisible()
    expect(screen.getByText('Aquí se pide personal.')).toBeVisible()
  })

  it('se puede avanzar y volver atrás', async () => {
    render(
      <Anfitriona>
        <button data-tour="uno">Crear requisición</button>
        <button data-tour="dos">Autorizar</button>
      </Anfitriona>,
    )
    const user = userEvent.setup()
    await abrirRecorrido(user)
    await screen.findByText('El primero', undefined, SLOW)

    await user.click(screen.getByRole('button', { name: /Siguiente/i }))
    expect(await screen.findByText('El segundo', undefined, SLOW)).toBeVisible()

    /* Nunca es un recorrido lineal obligatorio: se puede retroceder. */
    await user.click(screen.getByRole('button', { name: /Atrás/i }))
    expect(await screen.findByText('El primero', undefined, SLOW)).toBeVisible()
  })

  it('se salta los pasos cuyo control no está en pantalla', async () => {
    /* Solo el primero existe: un Supervisor no ve «Autorizar». */
    render(
      <Anfitriona>
        <button data-tour="uno">Crear requisición</button>
      </Anfitriona>,
    )
    const user = userEvent.setup()
    await abrirRecorrido(user)
    await screen.findByText('El primero', undefined, SLOW)

    expect(screen.queryByText('El que no está')).not.toBeInTheDocument()
    expect(screen.queryByText('El segundo')).not.toBeInTheDocument()
  })

  it('no abre nada cuando ningún control de la pantalla está presente', async () => {
    render(
      <Anfitriona>
        <p>Esta pantalla no tiene controles todavía.</p>
      </Anfitriona>,
    )
    const user = userEvent.setup()
    await abrirRecorrido(user)

    await waitFor(
      () => {
        expect(screen.queryByText('El primero')).not.toBeInTheDocument()
      },
      { timeout: 1500 },
    )
  })
})
