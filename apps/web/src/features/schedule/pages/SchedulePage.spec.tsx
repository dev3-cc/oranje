import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { SchedulePage } from './SchedulePage'

import { store } from '@/app/store'

/**
 * El Schedule compone `/schedules` (semana de Villas Coral) + sus entradas +
 * `/requisitions` (la demanda de `req-0005`): Houseman 1/4 y Housekeeper 2/2.
 * El grid semanal por hora reutiliza la arquitectura de la vista Horas del
 * Timesheet (grid + panel lateral + mini-calendario).
 */
function renderSchedule(): void {
  render(
    <Provider store={store}>
      <SchedulePage />
    </Provider>,
  )
}

describe('SchedulePage', () => {
  it('encabeza con el hotel y la semana del schedule', async () => {
    renderSchedule()

    expect(await screen.findByText(/Villas Coral · Semana /)).toBeInTheDocument()
    /* La cinta es continua: TODAS las semanas cargadas repiten los
       encabezados de día, no solo la que está a la vista. */
    expect(screen.getAllByText('Lun').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Dom').length).toBeGreaterThan(0)
  })

  it('el resumen dice cuánto está cubierto y manda los huecos a la Bolsa', async () => {
    renderSchedule()

    expect(await screen.findByText(/% cubierto/)).toBeInTheDocument()
    expect(screen.getByText(/se asignan desde la Bolsa de la Reclutadora/)).toBeInTheDocument()
  })

  it('sin turno elegido, el panel enseña la demanda de la semana por posición', async () => {
    renderSchedule()

    expect(await screen.findByText('Houseman')).toBeInTheDocument()
    expect(screen.getByText(/07:00 · demanda 4/)).toBeInTheDocument()
    expect(screen.getByText('1/4')).toBeInTheDocument()
    expect(screen.getByText('2/2')).toBeInTheDocument()
    expect(screen.getByText('cubierto')).toBeInTheDocument()
  })

  it('picar un turno del grid enseña a sus colaboradores en el panel', async () => {
    renderSchedule()

    const [shift] = await screen.findAllByText('07:00 – 15:30')
    shift?.closest('button')?.click()

    expect(await screen.findByText('Turno elegido')).toBeInTheDocument()
    expect(screen.getAllByText('Ana Rivera Gómez').length).toBeGreaterThan(0)
  })

  it('Agregar turno abre el diálogo con a quién, día y horario — antes solo por API', async () => {
    const user = userEvent.setup()
    renderSchedule()

    await user.click(await screen.findByRole('button', { name: 'Agregar turno' }))

    expect(await screen.findByText('Día', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByLabelText('Quién trabaja el turno')).toBeInTheDocument()
    expect(screen.getByLabelText('Día del turno')).toBeInTheDocument()
    expect(screen.getByLabelText('Hora de entrada')).toBeInTheDocument()
    expect(screen.getByLabelText('Hora de salida')).toBeInTheDocument()
    /* El botón de guardar empieza deshabilitado: falta llenar el formulario. */
    expect(screen.getByRole('button', { name: 'Agregar turno' })).toBeDisabled()
  })

  it('Agregar turno ofrece a quién elegir — gente con asignación activa en la demanda del hotel', async () => {
    const user = userEvent.setup()
    renderSchedule()

    await user.click(await screen.findByRole('button', { name: 'Agregar turno' }))
    await user.click(await screen.findByLabelText('Quién trabaja el turno'))

    /* No se afirma un nombre puntual — la lista sale de las asignaciones
       ACTIVAS sembradas en `requisitionsMocks`, no de un fixture propio. */
    const options = await screen.findAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
  })
})
