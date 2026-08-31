import { z } from 'zod'

/** Al menos una persona por posición: una fila de cantidad cero no pide nada. */
const QUANTITY_PATTERN = /^\d+$/

/**
 * Alta de una requisición contra el contrato REAL: posición, modalidad,
 * departamento e inglés se eligen de los catálogos del backend y viajan por id.
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
  catalogPositionId: z.string().min(1, 'Falta la posición'),
  hiringModalityId: z.string().min(1, 'Falta la modalidad'),
  /** Vacío = la posición no exige inglés (la columna es nulable). */
  englishLevelId: z.string(),
  hotelDepartmentId: z.string().min(1, 'Falta el departamento'),
  quantity: z
    .string()
    .refine(
      (value) => QUANTITY_PATTERN.test(value) && Number(value) >= 1,
      'Pide al menos 1 persona',
    ),
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
  /** Propuesta para las filas nuevas; cada posición lleva EL SUYO. */
  department: z.string(),
  positions: z.array(requisitionPositionDraftSchema).min(1, 'Agrega al menos una posición'),
})

export type RequisitionPositionDraft = z.infer<typeof requisitionPositionDraftSchema>
export type RequisitionForm = z.infer<typeof requisitionFormSchema>

/** Fila nueva: hereda el departamento de la cabecera, que es lo más común. */
export function emptyPositionDraft(hotelDepartmentId: string): RequisitionPositionDraft {
  return {
    catalogPositionId: '',
    hiringModalityId: '',
    englishLevelId: '',
    hotelDepartmentId,
    quantity: '1',
    startDate: '',
    startTime: '07:00',
  }
}
