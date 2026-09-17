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
  state: { code: string; color: string; name: string }
  isProfileComplete: boolean
  /// Si se le validó con el expediente a medias, hasta cuándo puede completarlo (ISO); null si no aplica.
  profileDueAt: string | null
  hasTaxId: boolean
  hasAccount: boolean
  /// El correo con el que entra hoy (worker.user_id); null sin cuenta todavía.
  email: string | null
  isBlacklisted: boolean
  createdAt: string
}
