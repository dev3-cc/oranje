import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { AuditsPage } from './AuditsPage'

import { store } from '@/app/store'

/**
 * La sesión mock de `sessionApi.ts` no trae zonas con hoteles (es un BD,
 * Ventas — el mismo grado de fidelidad que ya acepta
 * `PersonnelPage`/`TimesheetPage`): el camino "con hoteles de zona" queda
 * cubierto por `AuditHotelCard.spec.tsx` (renderizado directo con un
 * `hotelId` real). Esta prueba cubre lo que SÍ depende de la sesión: el
 * título y el aviso honesto de "sin hoteles en tu zona" (Hugo, 2026-10-16:
 * Auditorías pasó del Supervisor, un hotel fijo, al Inspector, por zona).
 */
describe('AuditsPage', () => {
  it('encabeza la pantalla y, sin hoteles en la zona, lo dice en vez de fingir uno', async () => {
    render(
      <Provider store={store}>
        <AuditsPage />
      </Provider>,
    )

    /* El intro es un Modal: mientras está abierto, Radix esconde el resto de
       la página (aria-hidden) — se cierra primero. Sin storage en jsdom es
       fail-open: sale siempre y se salta. */
    await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }))
    expect(await screen.findByRole('heading', { name: 'Auditorías' })).toBeInTheDocument()
    expect(
      await screen.findByText(/Todavía no tienes ningún hotel cliente en tus zonas asignadas/),
    ).toBeInTheDocument()
  })
})
