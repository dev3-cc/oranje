import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { MOCK_SUPERVISOR_HOTEL } from '../api/auditsMocks'

import { AuditHotelCard } from './AuditHotelCard'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderCard(canCreate = true): void {
  render(
    <Provider store={store}>
      <AuditHotelCard
        hotelId={MOCK_SUPERVISOR_HOTEL.id}
        hotelName={MOCK_SUPERVISOR_HOTEL.name}
        canCreate={canCreate}
      />
    </Provider>,
  )
}

/**
 * El Supervisor tiene UN SOLO hotel: la tarjeta lo muestra directo (sin
 * elegirlo) y "Inspeccionar" ofrece los dos caminos — Ambiente directo, Personal
 * vía la lista de "tiempo sin inspeccionar". Contra los fixtures reales de
 * `auditsMocks.ts`: Julia nunca fue inspeccionada, Ana sí hace 3 días.
 */
describe('AuditHotelCard', () => {
  it('enseña el hotel y, sin permiso de crear, dice quién sí puede', () => {
    renderCard(false)

    expect(screen.getByText('Villas Coral')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Inspeccionar/ })).not.toBeInTheDocument()
    expect(
      screen.getByText(/Las inspecciones las hace el Supervisor del hotel/),
    ).toBeInTheDocument()
  })

  it('Inspección de personal: lista al roster con quién nunca fue inspeccionado primero', async () => {
    renderCard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Inspeccionar/ }))
    await user.click(await screen.findByText('Inspección de personal'))

    expect(await screen.findByText('Julia Mendoza', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText('Ana Rivera Gómez')).toBeInTheDocument()

    // Julia nunca fue inspeccionada: su fila va primero y dice "Sin inspeccionar".
    const julia = screen.getByText('Julia Mendoza').closest('li') as HTMLElement
    expect(within(julia).getByText('Sin inspeccionar')).toBeInTheDocument()
  })

  it('elegir a un colaborador abre su formulario de Presentación Personal', async () => {
    renderCard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Inspeccionar/ }))
    await user.click(await screen.findByText('Inspección de personal'))
    await user.click(await screen.findByText('Julia Mendoza', undefined, SLOW))

    expect(await screen.findByText('Inspección de Presentación Personal')).toBeInTheDocument()
    expect(screen.getByText(/Inspeccionando a/)).toBeInTheDocument()
    expect(
      within(screen.getByText(/Inspeccionando a/)).getByText('Julia Mendoza'),
    ).toBeInTheDocument()
    // Las 4 categorías reales del reactivo, en mayúsculas.
    expect(await screen.findByText('Uniformidad', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText('Higiene')).toBeInTheDocument()
  })

  it('Inspeccionar por ambiente abre directo el formulario del hotel, sin elegir nada más', async () => {
    renderCard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Inspeccionar/ }))
    await user.click(await screen.findByText('Inspeccionar por ambiente'))

    expect(await screen.findByText('Percepción de Ambiente y Recursos')).toBeInTheDocument()
    expect(await screen.findByText('Insumos', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText('Entorno')).toBeInTheDocument()
  })

  it('contestar todos los reactivos habilita Finalizar y sube la calificación preliminar', async () => {
    renderCard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Inspeccionar/ }))
    await user.click(await screen.findByText('Inspeccionar por ambiente'))

    await screen.findByText('Insumos', undefined, SLOW)
    const finalize = screen.getByRole('button', { name: /Finalizar inspección/ })
    expect(finalize).toBeDisabled()

    // Contesta CUMPLE en los 7 reactivos de Ambiente.
    const cumpleButtons = screen.getAllByRole('button', { name: 'Cumple' })
    for (const button of cumpleButtons) {
      await user.click(button)
    }

    expect(finalize).toBeEnabled()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('7 de 7 contestados')).toBeInTheDocument()

    await user.click(finalize)

    // Guardada: el modal se cierra y el diálogo desaparece.
    await screen.findByText('Villas Coral', undefined, SLOW)
    expect(screen.queryByText('Percepción de Ambiente y Recursos')).not.toBeInTheDocument()
  })
})
