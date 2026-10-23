import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ANY_FILTER, MessagingFilters } from './MessagingFilters'

const OPTIONS = [
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'FAILED', label: 'Falló' },
]

describe('MessagingFilters', () => {
  it('solo pinta los filtros que recibe', () => {
    render(<MessagingFilters status={{ value: ANY_FILTER, options: OPTIONS, onChange: vi.fn() }} />)

    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Hotel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
  })

  it('con un filtro activo, «Quitar filtros» los regresa a todos', async () => {
    const onStatus = vi.fn()
    const onHotel = vi.fn()
    render(
      <MessagingFilters
        status={{ value: 'FAILED', options: OPTIONS, onChange: onStatus }}
        hotel={{ value: ANY_FILTER, options: [], onChange: onHotel }}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Quitar filtros/ }))

    expect(onStatus).toHaveBeenCalledWith(ANY_FILTER)
    expect(onHotel).toHaveBeenCalledWith(ANY_FILTER)
  })
})
