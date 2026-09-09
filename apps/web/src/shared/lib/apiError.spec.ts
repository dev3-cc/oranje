import { describe, expect, it } from 'vitest'

import { apiErrorMessage, humanizeApiMessage } from './apiError'

/** Regla de Hugo: ningún código de estado llega a un texto que lea una persona. */
describe('humanizeApiMessage', () => {
  it('traduce los códigos que no chocan entre semáforos', () => {
    expect(humanizeApiMessage('Esta semana ya está PENDING_APPROVAL')).toBe(
      'Esta semana ya está Enviada a aprobación',
    )
  })

  it('descarta el mensaje si queda un código ambiguo o desconocido', () => {
    // YELLOW es «En proceso» en Requisición y «Disp. voluntario» en el Colaborador.
    expect(humanizeApiMessage('Una requisición en YELLOW no se elimina')).toBeNull()
    expect(humanizeApiMessage('El estado FOO_BAR no existe')).toBeNull()
  })

  it('respeta las siglas que sí son lenguaje de la persona', () => {
    expect(humanizeApiMessage('Sube tu SSN o ITIN en PDF')).toBe('Sube tu SSN o ITIN en PDF')
  })
})

describe('apiErrorMessage', () => {
  const error = (message: string, code = 'X') => ({
    status: 409,
    data: { error: { code, message } },
  })

  it('con un código en el mensaje del backend, cae al fallback', () => {
    expect(
      apiErrorMessage(error('Una requisición en YELLOW no se elimina'), {
        fallback: 'No se pudo eliminar.',
      }),
    ).toBe('No se pudo eliminar.')
  })

  it('el override por código gana siempre', () => {
    expect(
      apiErrorMessage(error('Una requisición en YELLOW no se elimina', 'TRANSITION_NOT_ALLOWED'), {
        byCode: { TRANSITION_NOT_ALLOWED: 'No se elimina.' },
      }),
    ).toBe('No se elimina.')
  })
})
