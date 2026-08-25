import { z } from 'zod'

/**
 * Alta y edición de un prospecto (§4: React Hook Form + Zod).
 *
 * Cubre las tres tablas que toca el modal, tal como las nombra la maqueta:
 * `commercial.hotel` (el edificio), `commercial.hotel_contact` (el primer
 * contacto) y `commercial.prospect` (el ciclo comercial). D-13: el hotel es el
 * edificio y el prospecto es el ciclo, así que un mismo hotel puede tener
 * varios ciclos a lo largo del tiempo —pero solo uno abierto a la vez.
 */

export const HOTEL_SOURCES = ['NEW', 'EXISTING'] as const
export type HotelSource = (typeof HOTEL_SOURCES)[number]

/** Límites del radio de geocerca, en metros. */
export const GEOFENCE_MIN_M = 30
export const GEOFENCE_MAX_M = 1000
export const GEOFENCE_STEP_M = 10

export const prospectFormSchema = z
  .object({
    /**
     * Distingue crear de editar. No se pinta: existe para que el contacto sea
     * obligatorio SOLO al abrir el ciclo. Al editar, un prospecto viejo puede
     * no tener contacto todavía y no hay que bloquearle el resto de la ficha.
     */
    intent: z.enum(['CREATE', 'EDIT']),

    hotelSource: z.enum(HOTEL_SOURCES),
    /** Id del hotel ya registrado; vacío cuando se da de alta uno nuevo. */
    existingHotelId: z.string(),

    hotelName: z.string().trim().min(1, 'Escribe el nombre del hotel'),
    zoneId: z.string().min(1, 'Elige la zona'),
    timeZone: z.string().min(1, 'Elige la zona horaria'),
    /** Lo autollena Places; se puede corregir a mano. */
    address: z.string(),
    generalPhone: z.string(),

    location: z
      .object({ lat: z.number(), lng: z.number() })
      .nullable()
      /** `Boolean(...)` y no `!== null`: la comparación estrecharía la salida. */
      .refine((value) => Boolean(value), { message: 'Marca la ubicación en el mapa' }),

    /**
     * Dónde puso Google el punto al elegir el sitio. No viaja al backend:
     * sirve para saber si el pin se movió a mano después, que es justo lo que
     * el modal destaca.
     */
    placeLocation: z.object({ lat: z.number(), lng: z.number() }).nullable(),

    geofenceMeters: z
      .number()
      .int('La geocerca se mide en metros enteros')
      .min(GEOFENCE_MIN_M, `El radio mínimo es de ${String(GEOFENCE_MIN_M)} m`)
      .max(GEOFENCE_MAX_M, `El radio máximo es de ${String(GEOFENCE_MAX_M)} m`),

    contactFullName: z.string().trim(),
    contactJobTitle: z.string(),
    contactPhone: z.string(),
    /** Vacío es válido: no todos los contactos dan correo. */
    contactEmail: z.union([z.literal(''), z.email('El correo no se ve bien')]),
    isPrimaryContact: z.boolean(),

    ownerUserId: z.string().min(1, 'Elige al dueño del prospecto'),
    needDescription: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.intent === 'CREATE' && values.contactFullName === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['contactFullName'],
        message: 'El ciclo abre con un contacto: escribe su nombre',
      })
    }

    if (values.hotelSource === 'EXISTING' && values.existingHotelId === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['existingHotelId'],
        message: 'Elige el hotel ya registrado',
      })
    }
  })

export type ProspectFormValues = z.infer<typeof prospectFormSchema>
