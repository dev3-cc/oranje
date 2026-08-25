import { z } from 'zod'

/** Correo suficientemente bien formado. El definitivo lo valida el backend. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Alta de contactos de un hotel.
 *
 * Solo `fullName` es obligatorio: `hotel_contact` exige `full_name` y
 * `hotel_id`, y nada más. Puesto, teléfono y correo se registran con lo que se
 * tenga y se completan después — pedirlos aquí obligaría a inventarlos.
 *
 * El correo se valida con `refine` y no con `z.email()`: así el tipo de entrada
 * y el de salida siguen siendo el mismo `string`, que es lo que espera React
 * Hook Form para sus valores por defecto.
 */
export const hotelContactDraftSchema = z.object({
  fullName: z.string().trim().min(1, 'El nombre es obligatorio'),
  jobTitle: z.string(),
  phone: z.string(),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || EMAIL_PATTERN.test(value), 'Escribe un correo válido'),
  isPrimary: z.boolean(),
})

export const hotelContactsFormSchema = z.object({
  drafts: z.array(hotelContactDraftSchema).min(1, 'Agrega al menos un contacto'),
})

export type HotelContactDraft = z.infer<typeof hotelContactDraftSchema>
export type HotelContactsForm = z.infer<typeof hotelContactsFormSchema>

export const EMPTY_CONTACT_DRAFT: HotelContactDraft = {
  fullName: '',
  jobTitle: '',
  phone: '',
  email: '',
  isPrimary: false,
}
