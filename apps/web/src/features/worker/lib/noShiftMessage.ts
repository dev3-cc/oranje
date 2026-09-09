import { i18n } from '@lingui/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

/**
 * Qué se le dice al Colaborador cuando hoy no hay turno que ponchar. «Sin
 * turno» no es una sola causa: el Semáforo del Colaborador dice si descansa
 * (tiene asignación y hoy no le tocaba), si está en Stand-by o incapacidad,
 * si todavía no lo validan, o si nadie lo ha asignado. Amarillo es una
 * declaración de disponibilidad, no una asignación (vault, RR-C-02).
 */
export interface NoShiftMessage {
  title: string
  text: string
}

const ASSIGNED = new Set(['APPLE_GREEN', 'LIGHT_BLUE', 'ORANGE', 'BROWN'])
const UNASSIGNED = new Set(['STRONG_GREEN', 'YELLOW'])
const UNDER_REVIEW = new Set(['PURPLE', 'RED', 'BLACK'])

const NO_ASSIGNMENT = {
  title: msg`Aún no tienes asignación`,
  text: msg`Cuando Reclutamiento te asigne a una requisición, tu turno del día aparece aquí y podrás ponchar.`,
}

const NO_SHIFT_TITLE = msg`Hoy no tienes turno`

/** Se traduce AL LLAMAR, no al cargar: así sigue al idioma en caliente (D-36). */
function say(title: MessageDescriptor, text: MessageDescriptor): NoShiftMessage {
  return { title: i18n._(title), text: i18n._(text) }
}

export function noShiftMessageOf(stateCode: string | undefined): NoShiftMessage {
  if (stateCode === undefined) return say(NO_SHIFT_TITLE, NO_ASSIGNMENT.text)
  if (ASSIGNED.has(stateCode)) {
    return say(
      msg`Hoy descansas`,
      msg`No tienes turno programado hoy. Si sí te tocaba, avísale a tu Supervisor para que revise el Schedule.`,
    )
  }
  if (stateCode === 'PINK') {
    return say(
      msg`Estás en Stand-by`,
      msg`El hotel te mandó a descansar. Cuando te reactive, tus turnos vuelven a aparecer aquí.`,
    )
  }
  if (stateCode === 'GRAY') {
    return say(
      msg`Estás en incapacidad`,
      msg`Mientras dure tu incapacidad no hay turnos que ponchar. Tu Inspector lleva el seguimiento.`,
    )
  }
  if (stateCode === 'WHITE') {
    return say(
      msg`Aún no te validan`,
      msg`Cuando la Reclutadora valide tus datos quedarás Disponible para asignación. Con tu primera requisición, tu turno aparece aquí.`,
    )
  }
  if (UNDER_REVIEW.has(stateCode)) {
    return say(
      msg`Sin turnos por ahora`,
      msg`Tu situación está en revisión y no hay turnos que ponchar. Customer Service te puede orientar.`,
    )
  }
  if (UNASSIGNED.has(stateCode)) return say(NO_ASSIGNMENT.title, NO_ASSIGNMENT.text)
  return say(NO_SHIFT_TITLE, NO_ASSIGNMENT.text)
}
