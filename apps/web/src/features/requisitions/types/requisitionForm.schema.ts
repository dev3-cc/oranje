import { z } from 'zod'

import { ENGLISH_LEVELS } from '@/shared/constants/catalogs'

/** Al menos una persona por posición: una fila de cantidad cero no pide nada. */
const QUANTITY_PATTERN = /^\d+$/

/**
 * Alta de una requisición.
 *
 * La cantidad se valida como TEXTO y se convierte al enviar. Con
 * `z.coerce.number()` el tipo de entrada del esquema sería `unknown` y el de
 * salida `number`, y React Hook Form necesita que coincidan para poder tipar
 * sus valores por defecto.
 *
 * El número de la requisición NO está aquí: lo genera el backend al guardar
 * —`AAAAMMDDHHMM` más una homoclave de dos caracteres—, y un folio propuesto
 * por el navegador chocaría con el de otra alta simultánea.
 */
export const requisitionPositionDraftSchema = z.object({
  positionName: z.string().trim().min(1, 'Escribe la posición'),
  modality: z.enum(['POR_EVENTO', 'NOMINA']),
  english: z.enum(ENGLISH_LEVELS),
  department: z.string().trim().min(1, 'Falta el departamento'),
  quantity: z
    .string()
    .refine((value) => QUANTITY_PATTERN.test(value) && Number(value) >= 1, 'Mínimo 1'),
  startDate: z.string().min(1, 'Falta la fecha de inicio'),
  startTime: z.string().min(1, 'Falta la hora'),
})

/*
 * Los mensajes empiezan con «Falta» y no con «Elige»: el texto de la opción
 * vacía del `<select>` ya dice «Elige el hotel», y repetirlo como error deja dos
 * frases idénticas en pantalla sin saber cuál es la queja.
 */
export const requisitionFormSchema = z.object({
  hotelId: z.string().min(1, 'Falta el hotel'),
  department: z.string().min(1, 'Falta el departamento'),
  areaManagerId: z.string().min(1, 'Falta el GH responsable'),
  positions: z.array(requisitionPositionDraftSchema).min(1, 'Agrega al menos una posición'),
})

export type RequisitionPositionDraft = z.infer<typeof requisitionPositionDraftSchema>
export type RequisitionForm = z.infer<typeof requisitionFormSchema>

/** Fila nueva: hereda el departamento de la cabecera, que es lo más común. */
export function emptyPositionDraft(department: string): RequisitionPositionDraft {
  return {
    positionName: '',
    modality: 'POR_EVENTO',
    english: 'NO_REQUERIDO',
    department,
    quantity: '1',
    startDate: '',
    startTime: '07:00',
  }
}
