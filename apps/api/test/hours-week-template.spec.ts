import { renderTemplate } from '../src/infra/mailer/templates/index.js'

describe('plantilla del correo de horas', () => {
  const data = {
    name: 'Ana Pérez',
    hotelName: 'Fairfield Cancún',
    weekStart: '2026-09-28',
    weekEnd: '2026-10-04',
    approved: 3,
    pending: 2,
  }

  it('en español, nombra el hotel, el rango y los conteos', () => {
    const { subject, text } = renderTemplate('hours-week-status', 'es', data)

    expect(subject).toContain('Fairfield Cancún')
    expect(text).toContain('Ana Pérez')
    expect(text).toContain('3 aprobadas y 2 sin aprobar')
  })

  it('en inglés, con su propio texto', () => {
    const { text } = renderTemplate('hours-week-status', 'en', data)

    expect(text).toContain('3 approved and 2 still waiting for approval')
  })

  it('sin pendientes lo dice sin ambigüedad', () => {
    const { text } = renderTemplate('hours-week-status', 'es', { ...data, pending: 0 })

    expect(text).toContain('Las 3 hojas de horas de esta semana ya están aprobadas.')
  })

  it('sin horas en la semana no inventa conteos', () => {
    const { text } = renderTemplate('hours-week-status', 'es', { ...data, approved: 0, pending: 0 })

    expect(text).toContain('No se registró ninguna hoja de horas en esta semana.')
  })
})
