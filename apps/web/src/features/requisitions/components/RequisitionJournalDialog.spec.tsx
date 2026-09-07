import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import { RequisitionJournalDialog } from './RequisitionJournalDialog'

import { store } from '@/app/store'

/**
 * `req-0006` (GREEN, autorizada) trae los dos eventos del fixture de
 * `requisitionsMocks.ts`; `req-0001` (APPLE_GREEN, sin autorizar) trae solo la
 * creación — es el caso de la lista corta, no el vacío de verdad (crear
 * siempre deja un evento en el journal real).
 */
describe('RequisitionJournalDialog', () => {
  it('lista los eventos reales del más reciente al más viejo, con quién y su rol', async () => {
    render(
      <Provider store={store}>
        <RequisitionJournalDialog requisitionId="req-0006" onClose={vi.fn()} />
      </Provider>,
    )

    await screen.findByText('Requisición autorizada')
    expect(screen.getByText('Requisición creada')).toBeInTheDocument()
    expect(screen.getByText(/Gerardo Luna · ROL-H-03/)).toBeInTheDocument()

    // Autorizada (más reciente) antes que creada (más vieja) en el documento.
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Requisición autorizada')
    expect(items[1]).toHaveTextContent('Requisición creada')
  })

  it('una requisición sin autorizar solo muestra su creación', async () => {
    render(
      <Provider store={store}>
        <RequisitionJournalDialog requisitionId="req-0001" onClose={vi.fn()} />
      </Provider>,
    )

    await screen.findByText('Requisición creada')
    expect(screen.queryByText('Requisición autorizada')).not.toBeInTheDocument()
  })

  it('el botón Cerrar llama a onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Provider store={store}>
        <RequisitionJournalDialog requisitionId="req-0006" onClose={onClose} />
      </Provider>,
    )

    await screen.findByText('Requisición creada')
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('una requisición inexistente muestra el error, no una pantalla en blanco', async () => {
    render(
      <Provider store={store}>
        <RequisitionJournalDialog requisitionId="req-que-no-existe" onClose={vi.fn()} />
      </Provider>,
    )

    expect(
      await screen.findByText('No se pudo cargar la bitácora. Inténtalo de nuevo.'),
    ).toBeInTheDocument()
  })
})
