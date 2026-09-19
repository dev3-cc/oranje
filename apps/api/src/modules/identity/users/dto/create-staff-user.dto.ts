import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

// La ruta sale de POST /files con purpose USER_PHOTO, y se valida el prefijo:
// la lección del alta del Pool — sin esto se podría apuntar la foto a un
// documento ajeno de otra carpeta.
export const staffPhotoPath = z
  .string()
  .trim()
  .max(500)
  .regex(/^users\/photo\/[A-Za-z0-9._-]+$/, 'Debe ser una ruta devuelta por POST /files')

/**
 * Firebase es la autoridad de identidad (D-05). La credencial nace de dos
 * maneras, a elección del Administrador:
 *
 *  - Sin `password` (default) = invitación: la cuenta de Firebase se crea sin
 *    contraseña y Firebase manda el correo para que la persona establezca la
 *    suya.
 *  - Con `password`: la cuenta nace con esa contraseña y ES la de uso — sin
 *    cambio forzado; la persona la rota cuando quiera con «¿Olvidaste tu
 *    contraseña?». La contraseña jamás se persiste, ni al journal ni a logs,
 *    ni regresa en la respuesta.
 *
 * En ambos casos `firebase_uid` queda nulo y se enlaza en el primer login,
 * cuando el correo del token verificado coincide.
 */
export const createStaffUserSchema = z.object({
  email: z.email().trim().toLowerCase().max(255),
  fullName: z.string().trim().min(1).max(160),
  roleCode: z.string().trim().toUpperCase().min(1).max(20),
  /** El BD apunta a su BDC; la Reclutadora a su Líder. Nulo en la punta. */
  reportsToUserId: z.uuid().optional(),
  photoPath: staffPhotoPath.optional(),
  password: z.string().min(8).max(128).optional(),
  /**
   * Con `password`, el correo de bienvenida («tienes cuenta con este correo,
   * establece la tuya aquí») se manda igual salvo que el alta diga que no.
   * El correo nunca lleva la contraseña.
   */
  sendWelcomeEmail: z.boolean().optional().default(true),
})

export class CreateStaffUserDto extends createZodDto(createStaffUserSchema) {}
