export interface WorkerEntity {
  id: string
  fullName: string
  birthDate: string
  age: number
  gender: string
  phone: string
  address: string
  /// URL firmada, no la ruta: caduca en una hora.
  photoUrl: string | null
  zone: { id: string; code: string; name: string }
  position: { id: string; code: string; name: string } | null
  englishLevel: { id: string; code: string; name: string } | null
  hiringModality: { id: string; code: string; name: string } | null
  experienceLevel: string | null
  transportType: string | null
  emergencyContact: { name: string; phone: string; relationship: string } | null
  bloodType: string | null
  medicalNotes: string | null
  state: { code: string; color: string; name: string }
  isProfileComplete: boolean
  /// Si se le validó con el expediente a medias, hasta cuándo puede completarlo (ISO); null si no aplica.
  profileDueAt: string | null
  hasTaxId: boolean
  /// Hay un documento SSN/ITIN cargado (verificado o no) — a diferencia de
  /// `hasTaxId`, no depende del cifrado (D-27).
  hasTaxDocument: boolean
  /// Cargado y todavía sin revisar (Pool: badge/filtro "con documento pendiente").
  hasPendingDocument: boolean
  hasAccount: boolean
  /// El correo con el que entra hoy (worker.user_id); null sin cuenta todavía.
  email: string | null
  isBlacklisted: boolean
  createdAt: string
  /// La asignación ACTIVA más reciente: dónde está trabajando hoy. Null sin ninguna.
  assignment: {
    requisitionId: string
    requisitionNumber: string
    hotelId: string
    hotelName: string
  } | null
}

/**
 * Lo que el Hotel SÍ necesita de su propio personal (`staff:read`,
 * `staff:read_history` — Supervisor, Manager de Área, Manager General):
 * nunca el expediente completo que ve Reclutamiento. Confirmado con Hugo,
 * 2026-10-12: "nombre completo, género, posición, inglés, modalidad,
 * transporte, teléfono de emergencia, parentesco y notas médicas" — ni el
 * semáforo (Reclutamiento lo mueve), ni documentos/SSN, ni Blacklist, ni
 * cuenta del sistema, ni dirección/correo/cumpleaños/zona de Reclutamiento.
 */
export interface WorkerBasicEntity {
  id: string
  fullName: string
  gender: string
  photoUrl: string | null
  position: { id: string; code: string; name: string } | null
  englishLevel: { id: string; code: string; name: string } | null
  hiringModality: { id: string; code: string; name: string } | null
  transportType: string | null
  emergencyContact: { name: string; phone: string; relationship: string } | null
  medicalNotes: string | null
  /// Dónde está trabajando hoy: es justo lo que Mi Personal necesita mostrar.
  assignment: {
    requisitionId: string
    requisitionNumber: string
    hotelId: string
    hotelName: string
  } | null
}

/**
 * La misma básica, MÁS el color del semáforo (2026-10-12: se había quitado
 * de `WorkerBasicEntity` por el expediente, y eso rompía Mi Personal — sin
 * `state` no hay punto de color en la fila ni forma de saber si cabe
 * "Mandar a Stand-by"/"Reportar", que SÍ son del Hotel). La distinción real
 * no es "Hotel ve el semáforo o no": es "Hotel ve el COLOR vigente (lo
 * mismo que ya veía en el punto de la fila) pero no el Historial completo ni
 * los campos de verificación interna" — eso sigue siendo solo de
 * Reclutamiento, en `getScoped`/el expediente.
 */
export interface WorkerStaffEntity extends WorkerBasicEntity {
  state: { code: string; color: string; name: string }
}
