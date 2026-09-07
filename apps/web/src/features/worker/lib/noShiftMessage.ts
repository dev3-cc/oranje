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

const NO_ASSIGNMENT: NoShiftMessage = {
  title: 'Aún no tienes asignación',
  text: 'Cuando Reclutamiento te asigne a una requisición, tu turno del día aparece aquí y podrás ponchar.',
}

export function noShiftMessageOf(stateCode: string | undefined): NoShiftMessage {
  if (stateCode === undefined) return { title: 'Hoy no tienes turno', text: NO_ASSIGNMENT.text }
  if (ASSIGNED.has(stateCode)) {
    return {
      title: 'Hoy descansas',
      text: 'No tienes turno programado hoy. Si sí te tocaba, avísale a tu Supervisor para que revise el Schedule.',
    }
  }
  if (stateCode === 'PINK') {
    return {
      title: 'Estás en Stand-by',
      text: 'El hotel te mandó a descansar. Cuando te reactive, tus turnos vuelven a aparecer aquí.',
    }
  }
  if (stateCode === 'GRAY') {
    return {
      title: 'Estás en incapacidad',
      text: 'Mientras dure tu incapacidad no hay turnos que ponchar. Tu Inspector lleva el seguimiento.',
    }
  }
  if (stateCode === 'WHITE') {
    return {
      title: 'Aún no te validan',
      text: 'Cuando la Reclutadora valide tus datos quedarás Disponible para asignación. Con tu primera requisición, tu turno aparece aquí.',
    }
  }
  if (UNDER_REVIEW.has(stateCode)) {
    return {
      title: 'Sin turnos por ahora',
      text: 'Tu situación está en revisión y no hay turnos que ponchar. Customer Service te puede orientar.',
    }
  }
  if (UNASSIGNED.has(stateCode)) return NO_ASSIGNMENT
  return { title: 'Hoy no tienes turno', text: NO_ASSIGNMENT.text }
}
