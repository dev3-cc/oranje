import { I18nProvider } from '@lingui/react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { MobileShell } from '../components/MobileShell'
import { TaxDeadlineBanner } from '../components/TaxDeadlineBanner'
import type { TaxDeadlineApi } from '../types/worker.types'

import { NotificationsPage } from './NotificationsPage'
import { Phase2Page } from './Phase2Page'
import { Phase3Page } from './Phase3Page'

import { i18n } from '@/app/i18n'
import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

/* Con Router: la Fase 2 enlaza a la Fase 3 y un <Link> fuera de un Router truena. */
function renderPage(page: ReactElement): void {
  const router = createMemoryRouter([{ path: '/', element: page }], { initialEntries: ['/'] })
  render(
    <I18nProvider i18n={i18n}>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </I18nProvider>,
  )
}

function deadline(overrides: Partial<TaxDeadlineApi>): TaxDeadlineApi {
  return {
    status: 'OK',
    hasStarted: true,
    day: 2,
    dueAt: '2026-08-24T15:00:00.000Z',
    hasDocument: false,
    isDocumentVerified: false,
    taxRetentionApplies: true,
    wasRejected: false,
    rejectionReason: null,
    ...overrides,
  }
}

describe('el apartado del Colaborador', () => {
  it('la Fase 2 es un asistente de 3 pasos: foto, transporte y SSN/ITIN', async () => {
    renderPage(<Phase2Page />)
    const user = userEvent.setup()

    // Paso 1 · Tu foto: el contexto de la entrevista se ve desde aquí, sin campo editable.
    expect(
      await screen.findByText(/Tu posición \(Housekeeper\), modalidad \(Tiempo completo\)/),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/Posición/)).not.toBeInTheDocument()
    expect(screen.getByText(/Sigues en Blanco hasta que la Reclutadora valide/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    // Paso 2 · Transporte: el único campo que de verdad bloquea avanzar.
    const continueButton = screen.getByRole('button', { name: 'Continuar' })
    expect(continueButton).toBeDisabled()

    await user.click(screen.getByLabelText(/trasladas/))
    await user.click(await screen.findByRole('option', { name: 'Público' }))
    expect(continueButton).toBeEnabled()

    await user.click(continueButton)

    // Paso 3 · SSN/ITIN: llega solo tras guardar el transporte.
    expect(
      await screen.findByRole('button', { name: 'Subir mi SSN o ITIN' }, SLOW),
    ).toBeInTheDocument()
    expect(screen.getByText(/Tu transporte quedó guardado\./)).toBeInTheDocument()

    // Un solo camino hacia la Fase 3: el botón, no un enlace duplicado en el aviso de arriba.
    expect(
      screen.queryByRole('link', { name: /Sigue con tu contacto de emergencia/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Terminar' })).toHaveAttribute(
      'href',
      '/colaborador/alta-3',
    )
  })

  it('la Fase 3 cierra el expediente con emergencia, sangre y alergias', async () => {
    renderPage(<Phase3Page />)
    const user = userEvent.setup()

    const saveButton = await screen.findByRole('button', { name: 'Guardar' })
    expect(saveButton).toBeDisabled()

    expect(screen.getByText(/Alergias o condiciones médicas/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nombre/), 'Rubén Sandoval')
    await user.type(screen.getByLabelText(/^Teléfono$/), '404 512 8890')
    await user.click(screen.getByLabelText(/Parentesco/))
    await user.click(await screen.findByRole('option', { name: 'Cónyuge' }))
    expect(saveButton).toBeDisabled()

    await user.click(screen.getByLabelText(/Tipo de sangre/))
    await user.click(await screen.findByRole('option', { name: 'O+' }))
    expect(saveButton).toBeEnabled()

    await user.click(saveButton)

    // El formulario se sustituye por una pantalla de cierre con un solo camino: Inicio.
    expect(await screen.findByText('Completado', undefined, SLOW)).toBeInTheDocument()
    expect(
      screen.getByText('Tu expediente quedó completo. La Reclutadora lo validará (RF-08).'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/Nombre/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Inicio' })).toHaveAttribute(
      'href',
      '/colaborador',
    )
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

  it('el shell imita al móvil: logo, mi avatar con menú y las no leídas en el tab', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/collaborator',
          Component: MobileShell,
          children: [{ path: 'notifications', Component: NotificationsPage }],
        },
      ],
      { initialEntries: ['/collaborator/notifications'] },
    )
    render(
      <I18nProvider i18n={i18n}>
        <Provider store={store}>
          <RouterProvider router={router} />
        </Provider>
      </I18nProvider>,
    )

    expect(await screen.findByRole('img', { name: 'Oranje' })).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Cuenta de Rosa N.' }, SLOW),
    ).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Avisos · 1' }, SLOW)).toBeInTheDocument()
  })
})

describe('TaxDeadlineBanner', () => {
  // El plazo se unificó con el del expediente a medias (2026-09-30): este
  // banner ya no cuenta días, solo confirma si el documento llegó.
  it('sin documento cargado, no muestra nada', () => {
    const { container } = render(<TaxDeadlineBanner deadline={deadline({ hasDocument: false })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('cargado sin verificar: dice que está en verificación', () => {
    render(<TaxDeadlineBanner deadline={deadline({ hasDocument: true })} />)
    expect(screen.getByText(/cargado, en verificación/)).toBeInTheDocument()
  })

  it('verificado: lo dice sin el «en verificación»', () => {
    render(
      <TaxDeadlineBanner deadline={deadline({ hasDocument: true, isDocumentVerified: true })} />,
    )
    expect(screen.getByText(/está verificado/)).toBeInTheDocument()
    expect(screen.queryByText(/en verificación/)).not.toBeInTheDocument()
  })

  // Hugo, 2026-09-30: sin decir CUÁL documento y POR QUÉ, solo se veía
  // "carga tu SSN o ITIN" otra vez, sin explicar que ya lo había hecho.
  it('rechazado: dice el motivo y ofrece subirlo de nuevo', () => {
    renderPage(
      <TaxDeadlineBanner
        deadline={deadline({ hasDocument: false, wasRejected: true, rejectionReason: 'no se lee' })}
      />,
    )
    expect(screen.getByText('Tu SSN/ITIN fue rechazado')).toBeInTheDocument()
    expect(screen.getByText('no se lee')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Subir de nuevo' })).toHaveAttribute(
      'href',
      '/collaborator/signup-2',
    )
  })
})
