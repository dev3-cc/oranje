import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { WorkerDetailPage } from './WorkerDetailPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

/** Ana Rivera (`wrk-0001`): STRONG_GREEN, perfil completo, 3 documentos. */
function renderDetail(workerId = 'wrk-0001'): void {
  const router = createMemoryRouter(
    [{ path: '/pool-colaboradores/:workerId', element: <WorkerDetailPage /> }],
    { initialEntries: [`/pool-colaboradores/${workerId}`] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('WorkerDetailPage', () => {
  it('el encabezado dice quién es, su semáforo y lo del ITIN sin fingir', async () => {
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Ana Rivera Gómez' })).toBeInTheDocument()
    expect(screen.getByText('STRONG_GREEN · Disponible')).toBeInTheDocument()
    expect(screen.getByText('Perfil completo')).toBeInTheDocument()
    // D-27: el cifrado no está conectado — se dice la consecuencia, no «ITIN registrado».
    expect(screen.getByText('Sin ITIN · retención 16% (D-27)')).toBeInTheDocument()
  })

  it('identidad y perfil hablan en palabras, y lo que el contrato no trae va en raya', async () => {
    renderDetail()

    await screen.findByRole('heading', { name: 'Ana Rivera Gómez' })
    expect(screen.getByText('Femenino')).toBeInTheDocument()
    expect(screen.getByText('1–2 años')).toBeInTheDocument()
    expect(screen.getByText('Público')).toBeInTheDocument()
    expect(screen.getByText('O+')).toBeInTheDocument()
    // El parentesco del fixture es SIBLING y se lee en español.
    expect(screen.getByText('Hermano/a')).toBeInTheDocument()
    // medical_notes no viene en /workers/:id: raya, no invento.
    const medicalNotes = screen.getByText('Notas médicas').closest('div') as HTMLElement
    expect(within(medicalNotes).getByText('—')).toBeInTheDocument()
  })

  it('los documentos salen con su verificación real: dos verificados y el ITIN pendiente', async () => {
    renderDetail()

    expect(await screen.findByText('Identificación oficial', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText('Comprobante de domicilio')).toBeInTheDocument()
    expect(screen.getAllByText('Verificado')).toHaveLength(2)
    const itinRow = screen.getByText('SSN / ITIN').closest('li') as HTMLElement
    expect(within(itinRow).getByText('Pendiente')).toBeInTheDocument()
  })

  it('el historial cuenta el recorrido del seed, con el nacimiento en BLANCO sin origen', async () => {
    renderDetail()

    expect(await screen.findByText('— → WHITE', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText('WHITE → STRONG_GREEN')).toBeInTheDocument()
    expect(screen.getByText('Alta completada (RF-08)')).toBeInTheDocument()
    expect(screen.getByText('BROWN → STRONG_GREEN')).toBeInTheDocument()
  })

  it('cambiar estado ofrece solo lo de mi rol y la transición camina de verdad', async () => {
    renderDetail('wrk-0003')
    const user = userEvent.setup()

    // María Fernanda está Disponible: la Reclutadora solo puede asignarla temporal.
    await screen.findByRole('heading', { name: 'María Fernanda Ortiz' })
    await user.click(screen.getByRole('button', { name: 'Cambiar estado' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText('BROWN · Asig. temporal', undefined, SLOW),
    ).toBeInTheDocument()
    expect(within(dialog).queryByText(/ORANGE/)).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio'))
    await user.click(within(dialog).getByRole('button', { name: 'Aplicar transición' }))

    // El chip del encabezado se actualiza porque la mutación invalida la ficha.
    await waitFor(() => {
      expect(screen.getByText('BROWN · Asig. temporal')).toBeInTheDocument()
    }, SLOW)
    // Y la historia ganó su fila: la verdad del semáforo es la tabla de historia.
    expect(await screen.findByText('STRONG_GREEN → BROWN', undefined, SLOW)).toBeInTheDocument()
  })
})
