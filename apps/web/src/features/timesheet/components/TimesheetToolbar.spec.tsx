import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import { EMPTY_TIMESHEET_FILTERS, type TimesheetFilters } from '../types/timesheet.types'

import { TimesheetToolbar } from './TimesheetToolbar'

import { store } from '@/app/store'

/** Como la página: guarda lo que el toolbar sube y se lo devuelve como props. */
function Harness({
  initial,
  onChange,
}: {
  initial: TimesheetFilters
  onChange: (filters: TimesheetFilters) => void
}): ReactNode {
  const [filters, setFilters] = useState(initial)
  return (
    <Provider store={store}>
      <TimesheetToolbar
        filters={filters}
        requisitionNumbers={['202608120930·K7']}
        hotelNames={['Hotel Puerto Real']}
        columnWidth={96}
        onChange={(next) => {
          setFilters(next)
          onChange(next)
        }}
        onColumnWidthChange={() => undefined}
      />
    </Provider>
  )
}

describe('TimesheetToolbar', () => {
  it('el texto del buscador sube una sola vez, cuando la persona deja de teclear', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={EMPTY_TIMESHEET_FILTERS} onChange={onChange} />)

    const search = screen.getByLabelText('Buscar colaborador')
    await user.type(search, 'Ana')
    // El campo responde al instante; la consulta todavía no.
    expect(search).toHaveValue('Ana')
    expect(onChange).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ ...EMPTY_TIMESHEET_FILTERS, search: 'Ana' })
    })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('«Quitar filtros» cuenta los puestos y regresa todo a todos, sin tocar la semana', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={{
          ...EMPTY_TIMESHEET_FILTERS,
          search: 'Ana',
          status: 'APPROVED',
          weekStart: '2026-08-31',
        }}
        onChange={onChange}
      />,
    )

    const reset = screen.getByRole('button', { name: /Quitar filtros/ })
    expect(reset).toHaveTextContent('2')
    await user.click(reset)

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_TIMESHEET_FILTERS, weekStart: '2026-08-31' })
    expect(screen.getByLabelText('Buscar colaborador')).toHaveValue('')
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()

    // El borrador vacío ya coincide con lo que subió: el debounce no vuelve a llamar.
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('sin filtros puestos no hay nada que quitar', () => {
    render(<Harness initial={EMPTY_TIMESHEET_FILTERS} onChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
  })
})
