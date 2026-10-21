import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RecruitmentReportsPage } from './RecruitmentReportsPage'

// Registra los datos simulados de requisiciones, como en la app (buscador global).
import '@/app/searchApi'
import { store } from '@/app/store'

function renderReports(): void {
  const router = createMemoryRouter([{ path: '/reports', element: <RecruitmentReportsPage /> }], {
    initialEntries: ['/reports'],
  })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RecruitmentReportsPage', () => {
  it('el desempeño del equipo enlista a cada persona con su carga', async () => {
    renderReports()

    const seccion = (await screen.findByRole('heading', { name: 'Desempeño del equipo' })).closest(
      'section',
    )
    const tabla = within(seccion as HTMLElement)
    // El renglón de Marta dice a quién reporta: a Laura, su Líder.
    const marta = tabla.getByText('Marta Solís').closest('tr')
    expect(within(marta as HTMLElement).getByText('Laura Peña')).toBeInTheDocument()
    expect(tabla.getByText('Víanney Hernández')).toBeInTheDocument()
  })

  it('la cobertura por hotel deja fuera los borradores', async () => {
    renderReports()

    const seccion = (await screen.findByRole('heading', { name: 'Cobertura por hotel' })).closest(
      'section',
    )
    // Hotel Las Palmas tiene una requisición autorizada en cola.
    expect(within(seccion as HTMLElement).getByText('Hotel Las Palmas')).toBeInTheDocument()
  })

  it('descargar el CSV arma un archivo con la fecha en el nombre', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:reporte')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const nombres: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      nombres.push(this.download)
    })
    renderReports()

    const seccion = (await screen.findByRole('heading', { name: 'Desempeño del equipo' })).closest(
      'section',
    )
    await user.click(within(seccion as HTMLElement).getByRole('button', { name: 'Descargar CSV' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(nombres[0]).toMatch(/^desempeno-equipo-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
