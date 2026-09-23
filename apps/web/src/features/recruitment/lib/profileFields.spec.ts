import { describe, expect, it } from 'vitest'

import { assignmentReadiness } from './profileFields'

import type { WorkerApi } from '@/shared/types/apiContract.types'

const catalog = (name: string) => ({ id: name, code: name.toUpperCase(), name })

/** Lo mínimo que `assignmentReadiness` mira; el resto de la ficha no le importa. */
function worker(state: string, partial: Partial<WorkerApi> = {}): WorkerApi {
  return {
    state: { code: state, name: state, color: '#000' },
    position: null,
    englishLevel: null,
    hiringModality: null,
    experienceLevel: null,
    ...partial,
  } as WorkerApi
}

describe('assignmentReadiness — lo que contesta el anillo del avatar', () => {
  it('un Disponible ya se puede asignar aunque le falten datos', () => {
    /* La regla del vault: validar a sabiendas con el expediente a medias deja
       al colaborador habilitado, y lo que falte de Fase 1 no bloquea nada. */
    expect(assignmentReadiness(worker('STRONG_GREEN'))).toEqual({ kind: 'ready' })
  })

  it('quien ya está trabajando también cuenta como listo', () => {
    for (const state of ['APPLE_GREEN', 'LIGHT_BLUE', 'ORANGE', 'BROWN', 'YELLOW']) {
      expect(assignmentReadiness(worker(state))).toEqual({ kind: 'ready' })
    }
  })

  it('en Blanco cuenta lo que falta de la ENTREVISTA, no los siete campos', () => {
    const recienDadoDeAlta = assignmentReadiness(worker('WHITE'))
    expect(recienDadoDeAlta).toMatchObject({ kind: 'pending', done: 0, total: 4 })

    const conPosicionYModalidad = assignmentReadiness(
      worker('WHITE', { position: catalog('Housekeeper'), hiringModality: catalog('Temporal') }),
    )
    expect(conPosicionYModalidad).toMatchObject({ kind: 'pending', done: 2, total: 4 })

    /* Y dice CUÁLES faltan, no solo cuántos: el tooltip los nombra. */
    const faltantes =
      conPosicionYModalidad.kind === 'pending'
        ? conPosicionYModalidad.missing.map((m) => m.id ?? String(m.message))
        : []
    expect(faltantes).toHaveLength(2)
  })

  it('un accidentado o un vetado no se miden con esta vara', () => {
    for (const state of ['PINK', 'PURPLE', 'RED', 'GRAY', 'BLACK']) {
      expect(assignmentReadiness(worker(state))).toEqual({ kind: 'out' })
    }
  })
})
