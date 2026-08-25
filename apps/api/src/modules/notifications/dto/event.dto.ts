import { z } from 'zod'

import { createZodDto } from '../../../common/pipes/index.js'

// A quien va dirigido, en los terminos en que el publicador lo sabe. El evento
// NO trae la lista de personas: trae la regla, y este modulo la resuelve.
//
// Es la division que pide el vault —"el servicio resuelve el rol a personas
// concretas"— sin obligar a cada publicador a repetir la consulta.
export const audienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('USER'), userId: z.uuid() }),
  // La cuenta del colaborador, que puede no existir todavia.
  z.object({ kind: z.literal('WORKER'), workerId: z.uuid() }),
  z.object({ kind: z.literal('ROLE_IN_HOTEL'), roleCode: z.string(), hotelId: z.uuid() }),
  // departmentId nulo alcanza a todos los departamentos del hotel, que es lo
  // que separa al Manager General del de Area (D-09).
  z.object({
    kind: z.literal('ROLE_IN_HOTEL_DEPARTMENT'),
    roleCode: z.string(),
    hotelId: z.uuid(),
    departmentId: z.uuid(),
  }),
  z.object({ kind: z.literal('ROLE_IN_ZONE'), roleCode: z.string(), zoneId: z.uuid() }),
  z.object({ kind: z.literal('PROSPECT_OWNER'), prospectId: z.uuid() }),
  z.object({ kind: z.literal('REQUISITION_RECRUITERS'), requisitionId: z.uuid() }),
  z.object({ kind: z.literal('MANAGER_OF'), userId: z.uuid() }),
])

export type Audience = z.infer<typeof audienceSchema>

export const notificationEventSchema = z.object({
  type: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(500),
  entity: z.object({ type: z.string().trim().min(1).max(60), id: z.uuid() }).optional(),
  audience: z.array(audienceSchema).min(1).max(200),
})

export type NotificationEvent = z.infer<typeof notificationEventSchema>

// Lo que Pub/Sub manda en una suscripcion push: el evento va en base64 dentro
// de `message.data`.
export const pubsubPushSchema = z.object({
  message: z.object({
    data: z.string().min(1),
    messageId: z.string().optional(),
    publishTime: z.string().optional(),
  }),
  subscription: z.string().optional(),
})

export class PubSubPushDto extends createZodDto(pubsubPushSchema) {}
