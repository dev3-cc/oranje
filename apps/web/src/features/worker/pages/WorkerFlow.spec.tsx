import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { MobileShell } from '../components/MobileShell'

import { NotificationsPage } from './NotificationsPage'
import { Phase2Page } from './Phase2Page'
import { Phase3Page } from './Phase3Page'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderPage(page: ReactElement): void {
  render(<Provider store={store}>{page}</Provider>)
}

/**
 * El recorrido del Colaborador (opción b aprobada): Rosa Navarro nace en
 * BLANCO con la Fase 1 hecha; completa la 2 y la 3 desde su apartado y sus
 * avisos se marcan leídos al tocarlos. Los mocks mutan el MISMO perfil, así
 * que el orden de los tests ES el recorrido.
 */
describe('el apartado del Colaborador', () => {
  it('la Fase 2 exige los 5 del perfil laboral y confirma al enviar', async () => {
    renderPage(<Phase2Page />)
    const user = userEvent.setup()

    // El SSN/ITIN no se finge: está dicho como pendiente (D-27).
    expect(await screen.findByText('pendiente')).toBeInTheDocument()

    const sendButton = screen.getByRole('button', { name: 'Enviar' })
    expect(sendButton).toBeDisabled()

    // Los catálogos son los mismos de Requisiciones (ids reales del fixture).
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Housekeeper' })).toBeInTheDocument()
    }, SLOW)

    await user.selectOptions(screen.getByLabelText(/Posición/), 'pos-hk')
    await user.selectOptions(screen.getByLabelText(/Nivel de inglés/), 'eng-ba')
    await user.selectOptions(screen.getByLabelText(/Experiencia/), 'ONE_TO_TWO')
    await user.selectOptions(screen.getByLabelText(/Modalidad/), 'mod-ft')
    expect(sendButton).toBeDisabled()

    await user.selectOptions(screen.getByLabelText(/Transporte/), 'PUBLIC')
    expect(sendButton).toBeEnabled()

    await user.click(sendButton)
    expect(
      await screen.findByText('Perfil laboral guardado. Sigue la Fase 3.', undefined, SLOW),
    ).toBeInTheDocument()

    // El semáforo no se mueve por guardar: sigue en BLANCO hasta RF-08.
    expect(screen.getByText(/Sigues en BLANCO hasta que la Reclutadora valide/)).toBeInTheDocument()
  })

  it('la Fase 3 cierra el expediente: emergencia + sangre y el perfil queda completo', async () => {
    renderPage(<Phase3Page />)
    const user = userEvent.setup()

    const saveButton = await screen.findByRole('button', { name: 'Guardar' })
    expect(saveButton).toBeDisabled()

    await user.type(screen.getByLabelText(/Nombre/), 'Rubén Sandoval')
    await user.type(screen.getByLabelText(/Teléfono/), '+1 404 512 8890')
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
