import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { z } from 'zod'

/**
 * Validación del borrador de propuesta (§4: React Hook Form + Zod).
 *
 * La propuesta cotiza POR PUESTO: un renglón por posición del catálogo, con su
 * pay y su bill. La regla del margen es de NEGOCIO, no de formato: si se
 * factura por debajo de lo que se paga, cada hora trabajada cuesta dinero. Se
 * valida aquí para que no llegue a enviarse, y el API la vuelve a validar
 * (`RATE_MARGIN_NEGATIVE`) — si solo lo valida el front, basta un `curl` para
 * saltárselo.
 *
 * El margen SÍ puede ser cero: hay hoteles donde un puesto se cotiza al costo.
 * Lo que no puede es ser negativo.
 *
 * Son funciones y no constantes porque los mensajes se resuelven al armarlas
 * con el `i18n` del componente (D-36): quien las usa las rearma cuando cambia
 * el idioma. Las validaciones no dependen del idioma.
 */
export function buildProposalRateSchema(i18n: I18n) {
  return z.object({
    positionId: z.string().min(1, i18n._(msg`Elige el puesto`)),
    payRate: z.number().positive(i18n._(msg`El pay rate debe ser mayor que cero`)),
    billRate: z.number().positive(i18n._(msg`El bill rate debe ser mayor que cero`)),
  })
}

export function buildProposalDraftSchema(i18n: I18n) {
  return z
    .object({
      /** Campos del machote aprobado (2026-10-19): todos menos la marca son obligatorios.
          Título y Descripción se retiraron el mismo día: no están en el machote
          y el back nunca los exigió para enviar (Hugo). */
      propertyName: z
        .string()
        .trim()
        .min(1, i18n._(msg`Dinos el nombre de la propiedad en el documento`))
        .max(200),
      preparedDate: z
        .string()
        .trim()
        .min(1, i18n._(msg`Dinos la fecha de preparación del documento`))
        .max(40),
      brandManagementCompany: z.string().trim().max(200).optional(),
      cityState: z
        .string()
        .trim()
        .min(1, i18n._(msg`Dinos la ciudad y el estado del hotel`))
        .max(200),
      contactName: z
        .string()
        .trim()
        .min(1, i18n._(msg`Dinos a quién va dirigida la propuesta`))
        .max(200),
      senderPhone: z
        .string()
        .trim()
        .min(1, i18n._(msg`El teléfono de quien envía es obligatorio`))
        .max(40),
      senderEmail: z
        .string()
        .trim()
        .min(1, i18n._(msg`El correo de quien envía es obligatorio`))
        .email(i18n._(msg`Ese correo no es válido`))
        .max(200),
      rates: z
        .array(buildProposalRateSchema(i18n))
        .min(1, i18n._(msg`Agrega al menos un puesto con su tarifa`)),
    })
    .superRefine((values, ctx) => {
      values.rates.forEach((rate, index) => {
        if (rate.billRate < rate.payRate) {
          ctx.addIssue({
            code: 'custom',
            path: ['rates', index, 'billRate'],
            message: i18n._(
              msg`El bill rate no puede quedar por debajo del pay rate: se pierde en cada hora.`,
            ),
          })
        }
      })

      const seen = new Map<string, number>()

      values.rates.forEach((rate, index) => {
        if (rate.positionId === '') return

        const first = seen.get(rate.positionId)

        if (first === undefined) {
          seen.set(rate.positionId, index)
          return
        }

        ctx.addIssue({
          code: 'custom',
          path: ['rates', index, 'positionId'],
          message: i18n._(msg`Este puesto ya tiene su tarifa más arriba`),
        })
      })
    })
}

export type ProposalDraftForm = z.infer<ReturnType<typeof buildProposalDraftSchema>>
