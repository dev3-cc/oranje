import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { AuditsPage } from './AuditsPage'

import { store } from '@/app/store'

/**
 * La sesión mock de `sessionApi.ts` no trae hotel (es un BD, Ventas — el
 * mismo grado de fidelidad que ya acepta `PersonnelPage`/`TimesheetPage`):
 * el camino "con hotel" queda cubierto por `AuditHotelCard.spec.tsx`
 * (renderizado directo con un `hotelId` real). Esta prueba cubre lo que SÍ
 * depende de la sesión: el título y el aviso honesto de "sin hotel".
 */
describe('AuditsPage', () => {
  it('encabeza la pantalla y, sin hotel en la sesión, lo dice en vez de fingir uno', async () => {
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
      await screen.findByText(/Tu usuario no tiene un hotel asignado todavía/),
    ).toBeInTheDocument()
  })
})
