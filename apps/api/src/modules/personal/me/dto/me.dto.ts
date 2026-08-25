import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'
import { BLOOD_TYPES, RELATIONSHIPS, TRANSPORT_TYPES } from '../../workers/dto/create-worker.dto.js'

// Fases 2 y 3 (cambio del 2026-08-22). De la Fase 2 solo queda el TRANSPORTE:
// posicion, modalidad, ingles y experiencia las decide Oranje y las captura la
// Reclutadora en la entrevista.
//
// SSN e ITIN no estan aqui todavia: viven en columnas cifradas y el cifrado de
// campo sigue sin conectarse. Hoy lo que cuenta para el plazo de 3 dias es
// SUBIR el documento al expediente.
export const completeSignupSchema = z
  .object({
    transportType: z.enum(TRANSPORT_TYPES).optional(),

    emergencyContactName: z.string().trim().min(1).max(160).optional(),
    emergencyContactPhone: z.string().trim().min(7).max(32).optional(),
    emergencyContactRelationship: z.enum(RELATIONSHIPS).optional(),
    bloodType: z.enum(BLOOD_TYPES).optional(),
    medicalNotes: z.string().trim().min(1).max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay nada que completar' })

export class CompleteSignupDto extends createZodDto(completeSignupSchema) {}

// Lo unico editable despues. La posicion, la zona y la modalidad no entran: son
// decisiones de Reclutamiento. El SSN y el ITIN tampoco, por sensibles.
export const updateOwnContactSchema = z
  .object({
    phone: z.string().trim().min(7).max(32).optional(),
    emergencyContactName: z.string().trim().min(1).max(160).optional(),
    emergencyContactPhone: z.string().trim().min(7).max(32).optional(),
    emergencyContactRelationship: z.enum(RELATIONSHIPS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay nada que cambiar' })

export class UpdateOwnContactDto extends createZodDto(updateOwnContactSchema) {}
