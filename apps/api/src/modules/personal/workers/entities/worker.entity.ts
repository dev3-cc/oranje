export interface WorkerEntity {
  id: string
  fullName: string
  birthDate: string
  age: number
  gender: string
  phone: string
  address: string
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
  hasTaxId: boolean
  hasAccount: boolean
  isBlacklisted: boolean
  createdAt: string
}
