export interface HotelContactEntity {
  id: string
  hotelId: string
  fullName: string
  jobTitle: string | null
  phone: string | null
  email: string | null
  isPrimary: boolean
  isActive: boolean
  attemptCount: number
  canDelete: boolean
  createdAt: string
}
