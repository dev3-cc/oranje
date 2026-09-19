import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { AuditChecklistItemsPanel } from './AuditChecklistItemsPanel'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderPanel(): void {
  render(
    <Provider store={store}>
      <AuditChecklistItemsPanel />
    </Provider>,
  )
}

/**
 * El catálogo de reactivos (`catalogs.audit_checklist_item`), agrupado por
 * auditoría y categoría — solo aquí el Administrador edita el peso.
 */
describe('AuditChecklistItemsPanel', () => {
  it('agrupa los reactivos por auditoría y categoría, con su peso', async () => {
    renderPanel()

    expect(
      await screen.findByText(/Presentación Personal · Uniformidad/, undefined, SLOW),
    ).toBeInTheDocument()
    expect(screen.getByText('Uniforme completo, limpio y planchado')).toBeInTheDocument()
    expect(screen.getAllByText('Peso 1.00').length).toBeGreaterThan(0)
  })

  it('el filtro por auditoría deja solo Ambiente y Recursos', async () => {
    renderPanel()
    const user = userEvent.setup()

    await screen.findByText('Uniforme completo, limpio y planchado', undefined, SLOW)
    await user.click(screen.getByLabelText('Auditoría'))
    await user.click(await screen.findByRole('option', { name: 'Auditoría: Ambiente y Recursos' }))

    expect(screen.queryByText('Uniforme completo, limpio y planchado')).not.toBeInTheDocument()
    expect(screen.getByText('Químicos y materiales suficientes')).toBeInTheDocument()
    expect(screen.getByText('Quitar filtros')).toBeInTheDocument()
  })

  it('agregar un reactivo nuevo lo suma a su categoría', async () => {
    renderPanel()
    const user = userEvent.setup()

    await screen.findByText('Uniforme completo, limpio y planchado', undefined, SLOW)
    await user.click(screen.getByRole('button', { name: 'Agregar reactivo' }))

    await user.type(screen.getByLabelText('Categoría'), 'Puntualidad')
    await user.type(screen.getByLabelText('Texto del reactivo'), 'Llega antes del cambio de turno')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Llega antes del cambio de turno', undefined, SLOW),
    ).toBeInTheDocument()
  })

  it('borrar un reactivo en uso lo impide y explica por qué', async () => {
    renderPanel()
    const user = userEvent.setup()

    await screen.findByText('Uniforme completo, limpio y planchado', undefined, SLOW)
    await user.click(screen.getByLabelText('Eliminar Uniforme completo, limpio y planchado'))
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }))

    expect(
      await screen.findByText(/Hay auditorías con respuestas a este reactivo/, undefined, SLOW),
    ).toBeInTheDocument()
  })
})
