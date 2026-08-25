import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { MobileShell } from '../components/MobileShell'
import { SuspendedScreen, TaxDeadlineBanner } from '../components/TaxDeadlineBanner'
import type { TaxDeadlineApi } from '../types/worker.types'

import { NotificationsPage } from './NotificationsPage'
import { Phase2Page } from './Phase2Page'
import { Phase3Page } from './Phase3Page'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderPage(page: ReactElement): void {
  render(<Provider store={store}>{page}</Provider>)
}

function deadline(overrides: Partial<TaxDeadlineApi>): TaxDeadlineApi {
  return {
    status: 'OK',
    day: 2,
    dueAt: '2026-08-24T15:00:00.000Z',
    hasDocument: false,
    isDocumentVerified: false,
    taxRetentionApplies: true,
    ...overrides,
  }
}

/**
 * El recorrido del Colaborador tras el cambio del 2026-08-22: Rosa llega con
 * la Fase 1 completa (las 4 decisiones de Oranje ya capturadas), le queda el
 * transporte (Fase 2) y emergencia + sangre (Fase 3). Los mocks mutan el
 * MISMO perfil, así que el orden de los tests ES el recorrido.
 */
describe('el apartado del Colaborador', () => {
  it('la Fase 2 solo pide transporte: los 4 de Oranje ya vienen de la entrevista', async () => {
    renderPage(<Phase2Page />)
    const user = userEvent.setup()

    // Lo que decidió Oranje se dice, no se edita.
    expect(
      await screen.findByText(/Tu posición \(Housekeeper\), modalidad \(Tiempo completo\)/),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/Posición/)).not.toBeInTheDocument()

    // El plazo de 3 días, con su día real del fixture.
    expect(screen.getByText(/día 2 de 3/)).toBeInTheDocument()
    // La carga desde la app no existe todavía: se dice como pendiente.
    expect(screen.getByText('pendiente')).toBeInTheDocument()

    const sendButton = screen.getByRole('button', { name: 'Enviar' })
    expect(sendButton).toBeDisabled()

    await user.selectOptions(screen.getByLabelText(/trasladas/), 'PUBLIC')
    expect(sendButton).toBeEnabled()

    await user.click(sendButton)
    expect(
      await screen.findByText('Transporte guardado. Sigue la Fase 3.', undefined, SLOW),
    ).toBeInTheDocument()
    expect(screen.getByText(/Sigues en BLANCO hasta que la Reclutadora valide/)).toBeInTheDocument()
  })

  it('la Fase 3 cierra el expediente con emergencia, sangre y alergias', async () => {
    renderPage(<Phase3Page />)
    const user = userEvent.setup()

    const saveButton = await screen.findByRole('button', { name: 'Guardar' })
    expect(saveButton).toBeDisabled()

    // El vault lo llama así: es medical_notes, no una columna nueva.
    expect(screen.getByText(/Alergias o condiciones médicas/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nombre/), 'Rubén Sandoval')
    await user.type(screen.getByLabelText(/^Teléfono$/), '404 512 8890')
    await user.selectOptions(screen.getByLabelText(/Parentesco/), 'SPOUSE')
    expect(saveButton).toBeDisabled()

    await user.selectOptions(screen.getByLabelText(/Tipo de sangre/), 'O_POS')
    expect(saveButton).toBeEnabled()

    await user.click(saveButton)
    expect(
      await screen.findByText(
        'Listo: tu expediente quedó completo. La Reclutadora lo validará (RF-08).',
        undefined,
        SLOW,
      ),
    ).toBeInTheDocument()
  })

  it('los avisos: la no leída resalta y tocarla la marca', async () => {
    renderPage(<NotificationsPage />)
    const user = userEvent.setup()

    const unread = await screen.findByText('Completa tu alta', undefined, SLOW)
    expect(screen.getByText('Bienvenida a Oranje')).toBeInTheDocument()

    const unreadCard = unread.closest('button') as HTMLElement
    expect(unreadCard.querySelector('[aria-label="No leído"]')).not.toBeNull()

    await user.click(unreadCard)
    await waitFor(() => {
      expect(unreadCard.querySelector('[aria-label="No leído"]')).toBeNull()
    }, SLOW)
  })

  it('el shell imita al móvil: ORANJE, mi nombre corto y las no leídas en el tab', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/colaborador',
          Component: MobileShell,
          children: [{ path: 'avisos', Component: NotificationsPage }],
        },
      ],
      { initialEntries: ['/colaborador/avisos'] },
    )
    render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>,
    )

    expect(await screen.findByText('RANJE')).toBeInTheDocument()
    expect(await screen.findByText('Rosa N.', undefined, SLOW)).toBeInTheDocument()
    // Tras el test anterior queda UNA sin leer (el recordatorio de ponche).
    expect(await screen.findByRole('link', { name: 'Avisos · 1' }, SLOW)).toBeInTheDocument()
  })
})

/** Los tres momentos del plazo, directo sobre el banner (Reglas § Plazo de SSN/ITIN). */
describe('TaxDeadlineBanner', () => {
  it('días 1-3: dice cuánto queda y que la retención aplica', () => {
    render(<TaxDeadlineBanner deadline={deadline({ status: 'OK', day: 2 })} />)
    expect(screen.getByText(/día 2 de 3/)).toBeInTheDocument()
    expect(screen.getByText(/retención del 16%/)).toBeInTheDocument()
  })

  it('día 4: el interceptor avisa que mañana se suspende el acceso', () => {
    render(<TaxDeadlineBanner deadline={deadline({ status: 'NOTICE', day: 4 })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Mañana se suspende tu acceso')
  })

  it('con documento cargado: en verificación, y la retención sigue hasta verificar', () => {
    render(<TaxDeadlineBanner deadline={deadline({ hasDocument: true })} />)
    expect(screen.getByText(/cargado, en verificación/)).toBeInTheDocument()
    expect(screen.getByText(/sigue activa/)).toBeInTheDocument()
  })

  it('día 5: la pantalla de suspensión manda a Customer Service sin perder datos', () => {
    render(<SuspendedScreen />)
    expect(screen.getByText('Tu acceso está suspendido')).toBeInTheDocument()
    expect(screen.getByText(/Customer Service/)).toBeInTheDocument()
    expect(screen.getByText(/no se pierden/)).toBeInTheDocument()
  })
})
