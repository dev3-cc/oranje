import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { z } from 'zod'

/** Al menos una persona por posición: una fila de cantidad cero no pide nada. */
const QUANTITY_PATTERN = /^\d+$/
/** Las formas de las columnas destino: `start_date date` y `start_time time`. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** `2026-02-30` pasa el patrón pero no existe: se comprueba contra el calendario. */
function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

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
 *
 * Es una función y no una constante porque los mensajes se resuelven al
 * armarlo con el `i18n` del componente (D-36): quien lo usa lo rearma cuando
 * cambia el idioma. Las validaciones no dependen del idioma.
 */
export function buildRequisitionPositionDraftSchema(i18n: I18n) {
  return z.object({
    catalogPositionId: z.string().min(1, i18n._(msg`Falta la posición`)),
    hiringModalityId: z.string().min(1, i18n._(msg`Falta la modalidad`)),
    /** Vacío = la posición no exige inglés (la columna es nulable). */
    englishLevelId: z.string(),
    hotelDepartmentId: z.string().min(1, i18n._(msg`Falta el departamento`)),
    quantity: z
      .string()
      .refine(
        (value) => QUANTITY_PATTERN.test(value) && Number(value) >= 1,
        i18n._(msg`Pide al menos 1 persona`),
      )
      /* La columna es `integer`: un pedido de millones de slots no es un pedido. */
      .refine((value) => Number(value) <= 999, i18n._(msg`Máximo 999 personas por posición`)),
    startDate: z
      .string()
      .min(1, i18n._(msg`Falta la fecha de inicio`))
      .refine(
        (value) => DATE_PATTERN.test(value) && isRealDate(value),
        i18n._(msg`La fecha debe ser un día real (AAAA-MM-DD)`),
      ),
    startTime: z
      .string()
      .min(1, i18n._(msg`Falta la hora`))
      .refine(
        (value) => TIME_PATTERN.test(value),
        i18n._(msg`La hora debe ser HH:MM (00:00–23:59)`),
      ),
  })
}

/*
 * Los mensajes empiezan con «Falta» y no con «Elige»: el texto de la opción
 * vacía del `<select>` ya dice «Elige el hotel», y repetirlo como error deja dos
 * frases idénticas en pantalla sin saber cuál es la queja.
 */
export function buildRequisitionFormSchema(i18n: I18n) {
  return z.object({
    hotelId: z.string().min(1, i18n._(msg`Falta el hotel`)),
    /** Se elige UNA vez y baja a todas las posiciones del pedido. */
    department: z.string().min(1, i18n._(msg`Falta el departamento del hotel`)),
    positions: z
      .array(buildRequisitionPositionDraftSchema(i18n))
      .min(1, i18n._(msg`Agrega al menos una posición`)),
  })
}

export type RequisitionPositionDraft = z.infer<
  ReturnType<typeof buildRequisitionPositionDraftSchema>
>
export type RequisitionForm = z.infer<ReturnType<typeof buildRequisitionFormSchema>>

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
