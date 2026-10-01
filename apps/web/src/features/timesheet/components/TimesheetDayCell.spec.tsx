import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TimesheetEntry } from '../types/timesheet.types'

import { TimesheetDayCell } from './TimesheetDayCell'

function entry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    id: 'day-1',
    date: '2026-09-25',
    status: 'PENDING',
    hours: 2.8,
    startTime: null,
    endTime: null,
    requisitionNumber: null,
    punch: 'NO_SHIFT',
    hasAnomaly: false,
    isAbsence: false,
    reviewNote: null,
    punches: [],
    ...overrides,
  }
}

describe('TimesheetDayCell', () => {
  // El caso real que reportó Hugo (2026-09-25): en la columna angosta del
  // grid, la hora compartía renglón con el punto y la etiqueta y quedaba
  // cortada por el `truncate`.
  it('la hora del ponche va en su propio renglón, nunca cortada por el nombre del estado', () => {
    render(
      <TimesheetDayCell
        entry={entry({ punch: 'COMPLETE', startTime: '08:03', endTime: '16:15' })}
        isSelected={false}
        onToggle={vi.fn()}
        onReview={vi.fn()}
      />,
    )

    const time = screen.getByText('08:03 – 16:15')
    const label = screen.getByText('Ponches completos')

    expect(time).toBeInTheDocument()
    // Renglones distintos: el contenedor de la hora no es el de la etiqueta.
    expect(time.parentElement).not.toBe(label.parentElement)
  })

  it('sin marcas, no inventa un horario', () => {
    render(
      <TimesheetDayCell entry={entry()} isSelected={false} onToggle={vi.fn()} onReview={vi.fn()} />,
    )

    expect(screen.getByText('Sin ponches')).toBeInTheDocument()
    expect(screen.queryByText(/–/)).not.toBeInTheDocument()
  })

  // Hugo, 2026-10-01: un día en curso con solo entrada no es un problema —
  // antes se leía igual que un día pasado al que le faltó una marca.
  it('hoy, con entrada y sin salida, dice "en curso" y no "incompletos"', () => {
    render(
      <TimesheetDayCell
        entry={entry({ punch: 'IN_PROGRESS', startTime: '08:03', endTime: null })}
        isSelected={false}
        onToggle={vi.fn()}
        onReview={vi.fn()}
      />,
    )

    expect(screen.getByText('Trabajando ahora')).toBeInTheDocument()
    expect(screen.queryByText(/incompletos/)).not.toBeInTheDocument()
  })

  // Antes el renglón de hora exigía las DOS marcas o no mostraba nada; un día
  // ya pasado con solo entrada se leía igual que uno sin ningún ponche.
  it('con una sola marca muestra esa hora y un guion del lado que falta', () => {
    render(
      <TimesheetDayCell
        entry={entry({ punch: 'INCOMPLETE', startTime: '08:03', endTime: null })}
        isSelected={false}
        onToggle={vi.fn()}
        onReview={vi.fn()}
      />,
    )

    expect(screen.getByText('08:03 – —')).toBeInTheDocument()
  })
})
