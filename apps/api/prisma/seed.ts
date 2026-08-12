import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

/**
 * Seed de catálogos — Fase 3 del Plan de Implementación.
 *
 * Las reglas del negocio son FILAS, no código: los semáforos se configuran, no
 * se programan. Sin esto el esquema existe y el negocio no funciona.
 *
 * Todo sale del vault. Nada se inventa aquí:
 *   Core/Catálogos/                    los 5 catálogos
 *   Core/Módulos/Semáforos/            los 7 semáforos y sus estados
 *   Arquitecturas/<depto>/01 - Portada.md   los IDs de rol
 *
 * Es IDEMPOTENTE: cada fila se identifica por su `code` y se hace upsert, así
 * que correrlo dos veces no duplica nada.
 *
 * El `id` es uuid v7 generado aquí, no por Postgres: la sección 4 de Estándares
 * de Base de Datos lo exige y `gen_random_uuid()` devuelve v4.
 */

// El seed escribe catálogos, así que corre como el migrador. Cae a DATABASE_URL
// solo para no romper en ambientes donde no se haya separado el usuario.
const adapter = new PrismaPg({
  connectionString: process.env['MIGRATE_DATABASE_URL'] ?? process.env['DATABASE_URL'],
})
const prisma = new PrismaClient({ adapter })

// ---------------------------------------------------------------------------
// Roles — Arquitecturas/<depto>/01 - Portada.md
//
// Convención de los IDs, la misma que ya usan Hotel y Ventas: el rol OPERATIVO
// de base es 01 y de ahí hacia arriba. Reclutamiento usaba ROL-01…ROL-05 sin
// letra de departamento y se unificó a ROL-R-NN.
//
// Sistema y Administrador estaban tres veces, uno por departamento. Son
// transversales, así que quedan como ROL-SYS-01 y ROL-ADM-01: repetirlos
// obligaría a triplicar sus permisos en role_permission.
// ---------------------------------------------------------------------------
const ROLES: Array<{ code: string; name: string; department: string | null }> = [
  { code: 'ROL-H-01', name: 'Supervisor', department: 'Hotel' },
  { code: 'ROL-H-02', name: 'Manager de Área', department: 'Hotel' },
  { code: 'ROL-H-03', name: 'Manager General', department: 'Hotel' },

  { code: 'ROL-R-01', name: 'Reclutadora', department: 'Reclutamiento' },
  { code: 'ROL-R-02', name: 'Líder de Grupo de Reclutadoras', department: 'Reclutamiento' },
  { code: 'ROL-R-03', name: 'Manager de Reclutamiento', department: 'Reclutamiento' },

  { code: 'ROL-V-01', name: 'Business Developer', department: 'Ventas' },
  { code: 'ROL-V-02', name: 'Business Developer Coordinator', department: 'Ventas' },

  { code: 'ROL-I-01', name: 'Inspector', department: 'Inspección' },
  { code: 'ROL-I-02', name: 'Coordinador', department: 'Inspección' },

  { code: 'ROL-Q-01', name: 'Operador de QA', department: 'QA' },
  { code: 'ROL-Q-02', name: 'Manager de QA', department: 'QA' },

  { code: 'ROL-CS-01', name: 'Agente de Customer Service', department: 'Customer Service' },
  { code: 'ROL-CS-02', name: 'Customer Service Manager', department: 'Customer Service' },

  { code: 'ROL-CO-01', name: 'Contadora', department: 'Contabilidad' },
  { code: 'ROL-CO-02', name: 'Manager de Contabilidad', department: 'Contabilidad' },

  { code: 'ROL-C-01', name: 'Colaborador', department: null },
  { code: 'ROL-SYS-01', name: 'Sistema', department: null },
  { code: 'ROL-ADM-01', name: 'Administrador', department: null },
]

// ---------------------------------------------------------------------------
// Catálogos — Core/Catálogos/
//
// Dos de ellos advierten "lista no exhaustiva": Posiciones y Zonas. Se siembra
// SOLO lo documentado; el negocio agrega el resto desde la aplicación.
// ---------------------------------------------------------------------------
const HOTEL_DEPARTMENTS = [
  { code: 'HOUSEKEEPING', name: 'Housekeeping' },
  { code: 'FOOD', name: 'Alimentos' },
  { code: 'MAINTENANCE', name: 'Mantenimiento' },
  { code: 'FRONT_DESK', name: 'Front Desk' },
]

/// Agrupadas por departamento, como las lista el vault.
const POSITIONS = [
  { code: 'HOUSEKEEPER', name: 'Housekeeper', department: 'HOUSEKEEPING' },
  { code: 'HOUSEMAN', name: 'Houseman', department: 'HOUSEKEEPING' },
  { code: 'LAUNDRY', name: 'Laundry', department: 'HOUSEKEEPING' },
  { code: 'CHEF', name: 'Chef', department: 'FOOD' },
]

const HIRING_MODALITIES = [
  { code: 'FULL_TIME', name: 'Tiempo completo' },
  { code: 'PART_TIME', name: 'Medio tiempo' },
  { code: 'TEMPORARY', name: 'Temporal' },
  { code: 'ON_REQUEST', name: 'Según solicitud' },
]

const ENGLISH_LEVELS = [
  { code: 'BASIC', name: 'Básico', order: 1 },
  { code: 'INTERMEDIATE', name: 'Intermedio', order: 2 },
  { code: 'ADVANCED', name: 'Avanzado', order: 3 },
  { code: 'CONVERSATIONAL', name: 'Conversacional', order: 4 },
]

const ZONES = [
  { code: 'CENTRO', name: 'Centro' },
  { code: 'SUR', name: 'Sur' },
  { code: 'ESTE', name: 'Este' },
  { code: 'OESTE', name: 'Oeste' },
  { code: 'NOROESTE', name: 'Noroeste' },
  { code: 'SURESTE', name: 'Sureste' },
]

// ---------------------------------------------------------------------------
// Los 7 semáforos y sus estados — Core/Módulos/Semáforos/
//
// El `code` va en inglés y el `name` en español (D-11). El color es el que el
// vault documenta; los hex viven en Convenciones de Diseño, no aquí.
//
// is_branch marca los estados que son RAMA y no paso del avance normal.
// ---------------------------------------------------------------------------
type State = { code: string; color: string; name: string; branch?: boolean }
type Light = { code: string; name: string; description: string; states: State[] }

const LIGHTS: Light[] = [
  {
    code: 'WORKER',
    name: 'Semáforo del Colaborador',
    description: 'Situación del colaborador. 12 estados.',
    states: [
      { code: 'WHITE', color: 'Blanco', name: 'Pre-asignación' },
      { code: 'APPLE_GREEN', color: 'Verde manzana', name: 'Día 1-2' },
      { code: 'LIGHT_BLUE', color: 'Azul claro', name: 'Día 3+' },
      { code: 'ORANGE', color: 'Naranja', name: 'Fijo' },
      { code: 'STRONG_GREEN', color: 'Verde fuerte', name: 'Disponible' },
      { code: 'YELLOW', color: 'Amarillo', name: 'Disponible voluntario' },
      { code: 'BROWN', color: 'Café', name: 'Asignación temporal' },
      { code: 'PINK', color: 'Rosa', name: 'Stand-by' },
      { code: 'PURPLE', color: 'Morado', name: 'No regresó', branch: true },
      { code: 'RED', color: 'Rojo', name: 'Reportado', branch: true },
      { code: 'GRAY', color: 'Gris', name: 'Accidentado', branch: true },
      { code: 'BLACK', color: 'Negro', name: 'Blacklist', branch: true },
    ],
  },
  {
    code: 'REQUISITION',
    name: 'Semáforo de Requisición',
    description: 'Ciclo de vida de una requisición.',
    states: [
      { code: 'APPLE_GREEN', color: 'Verde manzana', name: 'En elaboración' },
      { code: 'GREEN', color: 'Verde', name: 'Autorizada' },
      { code: 'YELLOW', color: 'Amarillo', name: 'En proceso' },
      { code: 'LIGHT_BLUE', color: 'Azul claro', name: 'Cubierta totalmente' },
      { code: 'RED', color: 'Rojo', name: 'Cubierta parcialmente' },
      { code: 'PURPLE', color: 'Morado', name: 'Eliminada', branch: true },
    ],
  },
  {
    code: 'POSITION_COVERAGE',
    name: 'Semáforo de Posiciones de la Requisición',
    description: 'Porcentaje de cobertura por posición.',
    states: [
      { code: 'GOLD', color: 'Dorado', name: 'En preparación' },
      { code: 'ORANGE', color: 'Naranja', name: 'Autorizada' },
      { code: 'GREEN', color: 'Verde', name: '100% cubierta' },
      { code: 'YELLOW', color: 'Amarillo', name: 'Hasta 25% faltante' },
      { code: 'RED', color: 'Rojo', name: 'Más de 25% faltante' },
      { code: 'PURPLE', color: 'Morado', name: 'Eliminada', branch: true },
    ],
  },
  {
    code: 'URGENCY',
    name: 'Semáforo de Urgencia de Requisición',
    description: 'Urgencia por tiempo restante. Derivado de authorized_at contra start_date.',
    states: [
      { code: 'STRONG_GREEN', color: 'Verde fuerte', name: 'Normal' },
      { code: 'YELLOW', color: 'Amarillo', name: 'Medio' },
      { code: 'RED', color: 'Rojo', name: 'Urgente' },
    ],
  },
  {
    code: 'ONBOARDING',
    name: 'Semáforo Onboarding',
    description: 'Ciclo comercial del hotel: prospecto a cliente.',
    states: [
      { code: 'GRAY', color: 'Gris', name: 'Hotel identificado' },
      { code: 'LIGHT_BLUE', color: 'Azul claro', name: 'Contacto y recopilación de datos' },
      { code: 'GREEN', color: 'Verde', name: 'Propuesta enviada' },
      { code: 'YELLOW', color: 'Amarillo', name: 'En seguimiento tras propuesta' },
      { code: 'PINK', color: 'Rosa', name: 'Negociación de términos' },
      { code: 'ORANGE', color: 'Naranja', name: 'Acuerdo firmado, hotel cliente activo' },
      { code: 'RED', color: 'Rojo', name: 'Rechazo o no interés', branch: true },
      { code: 'BROWN', color: 'Café', name: 'Renegociación o desbloqueo', branch: true },
      { code: 'BLACK', color: 'Negro', name: 'Cliente pausado o inactivo', branch: true },
    ],
  },
  {
    code: 'QUALITY',
    name: 'Indicador de Calidad',
    description: 'Desempeño de un área supervisada por QA.',
    states: [
      { code: 'GREEN', color: 'Verde', name: 'Calidad óptima' },
      { code: 'YELLOW', color: 'Amarillo', name: 'Calidad en riesgo' },
      { code: 'RED', color: 'Rojo', name: 'Calidad crítica' },
    ],
  },
  {
    code: 'TIMESHEET_COMPLIANCE',
    name: 'Indicador de Cumplimiento del Timesheet',
    description: 'Horas reales contra contractuales.',
    states: [
      { code: 'GREEN', color: 'Verde', name: 'Cumplimiento' },
      { code: 'YELLOW', color: 'Amarillo', name: 'Alerta' },
      { code: 'RED', color: 'Rojo', name: 'Anomalía' },
      { code: 'GRAY', color: 'Gris', name: 'Sin datos' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Transiciones del Semáforo Onboarding — Ventas/Semáforo Onboarding y Base de
// Datos.drawio, página 3.
//
// SOLO el Onboarding. Los otros 6 semáforos tienen sus estados documentados
// pero no qué movimientos son legales: eso es trabajo de negocio.
//
// Del vault: los 12 pares y el rol que autoriza cada uno.
// PROPUESTA del diagrama, no del vault: la columna `reason`. El vault no dice
// qué transiciones exigen motivo. El criterio aplicado es que lo exige toda
// transición que cierra o desbloquea un ciclo.
//
// Cualquier par que no esté aquí es un 409, no un estado alcanzable: no existe
// GREEN -> ORANGE ni BROWN -> GREEN.
// ---------------------------------------------------------------------------
const ONBOARDING_TRANSITIONS: Array<{
  from: string
  to: string
  roles: string[]
  reason: boolean
}> = [
  { from: 'GRAY', to: 'LIGHT_BLUE', roles: ['ROL-V-01'], reason: false },
  { from: 'LIGHT_BLUE', to: 'GREEN', roles: ['ROL-V-01'], reason: false },
  { from: 'GREEN', to: 'YELLOW', roles: ['ROL-V-01'], reason: false },
  { from: 'GREEN', to: 'RED', roles: ['ROL-V-01'], reason: true },
  // BD o BDC: son dos filas, una por rol
  { from: 'GREEN', to: 'BROWN', roles: ['ROL-V-01', 'ROL-V-02'], reason: true },
  { from: 'YELLOW', to: 'PINK', roles: ['ROL-V-01'], reason: false },
  // RR-V-01: la conversión es EXCLUSIVA del BDC
  { from: 'PINK', to: 'ORANGE', roles: ['ROL-V-02'], reason: false },
  { from: 'PINK', to: 'BROWN', roles: ['ROL-V-02'], reason: true },
  { from: 'ORANGE', to: 'BLACK', roles: ['ROL-V-02'], reason: true },
  // RR-V-07: Azul claro es el ÚNICO punto de reentrada
  { from: 'RED', to: 'LIGHT_BLUE', roles: ['ROL-V-01'], reason: false },
  { from: 'BROWN', to: 'LIGHT_BLUE', roles: ['ROL-V-02'], reason: true },
  { from: 'BLACK', to: 'LIGHT_BLUE', roles: ['ROL-V-02'], reason: true },
]

/**
 * Los 4 estados en los que el colaborador TIENE asignación activa.
 *
 * No está enunciado así en el vault, se deriva de la línea 322 de `Reglas de
 * Negocio`: «Estados que no permiten ponchado: Rosa (Stand-by) y Amarillo
 * (Disponible voluntario), porque en ninguno de los dos existe asignación
 * activa». Blanco todavía no está validado, y Morado/Rojo/Gris/Negro ya son
 * estados de incidencia.
 *
 * Importa porque las cuatro transiciones de incidencia SOLO pueden salir de
 * aquí: no se puede faltar sin Schedule, el hotel no retira de una posición que
 * no existe, no reporta a quien no trabaja ahí, y el accidente LABORAL ocurre
 * trabajando.
 */
const WORKER_OPERATIONAL = ['APPLE_GREEN', 'LIGHT_BLUE', 'ORANGE', 'BROWN']

const WORKER_TRANSITIONS: Array<{
  from: string
  /** `null` = el destino es el estado previo; lo resuelve el servicio leyendo la historia. */
  to: string | null
  roles: string[]
  reason: boolean
  note?: string
}> = [
  // --- entradas y progresión como fijo ---
  // Blanco NO lleva fila: es el estado inicial con que nace el worker, igual que
  // GRAY en el Onboarding. Una transición necesita origen.
  {
    from: 'WHITE',
    to: 'STRONG_GREEN',
    roles: ['ROL-R-01'],
    reason: false,
    note: 'valida la Reclutadora (RF-08)',
  },
  {
    from: 'STRONG_GREEN',
    to: 'APPLE_GREEN',
    roles: ['ROL-SYS-01'],
    reason: false,
    note: 'asignado y asiste el día 1',
  },
  {
    from: 'APPLE_GREEN',
    to: 'LIGHT_BLUE',
    roles: ['ROL-SYS-01'],
    reason: false,
    note: 'poncha al tercer día',
  },
  {
    from: 'LIGHT_BLUE',
    to: 'ORANGE',
    roles: ['ROL-SYS-01'],
    reason: false,
    note: 'completa 7 días: fijo',
  },
  { from: 'ORANGE', to: 'STRONG_GREEN', roles: ['ROL-SYS-01'], reason: false, note: 'queda libre' },

  // --- disponibilidad voluntaria: 3 orígenes, y los 3 los dispara el colaborador ---
  { from: 'STRONG_GREEN', to: 'YELLOW', roles: ['ROL-C-01'], reason: false },
  { from: 'ORANGE', to: 'YELLOW', roles: ['ROL-C-01'], reason: false },
  { from: 'PINK', to: 'YELLOW', roles: ['ROL-C-01'], reason: false },

  // --- asignación temporal: la Reclutadora o su Líder de Grupo ---
  { from: 'STRONG_GREEN', to: 'BROWN', roles: ['ROL-R-01', 'ROL-R-02'], reason: false },
  { from: 'YELLOW', to: 'BROWN', roles: ['ROL-R-01', 'ROL-R-02'], reason: false },

  // --- las 4 de destino variable (returns_to_previous) ---
  {
    from: 'BROWN',
    to: null,
    roles: ['ROL-SYS-01'],
    reason: false,
    note: 'vencen los días asignados',
  },
  {
    from: 'BROWN',
    to: null,
    roles: ['ROL-R-01', 'ROL-R-02'],
    reason: false,
    note: 'cancelación manual',
  },
  { from: 'PURPLE', to: null, roles: ['ROL-SYS-01'], reason: false, note: 'vuelve a ponchar' },

  // --- stand-by: los 3 roles del hotel lo ponen y lo quitan ---
  { from: 'PINK', to: 'STRONG_GREEN', roles: ['ROL-H-01', 'ROL-H-02', 'ROL-H-03'], reason: false },

  // --- resolución de incidencias ---
  {
    from: 'PURPLE',
    to: 'BLACK',
    roles: ['ROL-SYS-01'],
    reason: false,
    note: '3 inasistencias, automático',
  },
  {
    from: 'RED',
    to: 'BLACK',
    roles: ['ROL-I-01'],
    reason: true,
    note: 'disputa a favor del hotel',
  },
  {
    from: 'RED',
    to: 'STRONG_GREEN',
    roles: ['ROL-I-01'],
    reason: true,
    note: 'disputa a favor del colaborador',
  },
  // El alta médica NO la cierra el sistema: «requiere alta médica + cierre de
  // tarjeta de accidente por el Inspector» (Reglas de Negocio, Protección Gris).
  {
    from: 'GRAY',
    to: 'STRONG_GREEN',
    roles: ['ROL-I-01'],
    reason: false,
    note: 'alta médica y cierre de tarjeta',
  },

  // --- las 4 de incidencia, desde cada estado operativo ---
  ...WORKER_OPERATIONAL.map((from) => ({
    from,
    to: 'PURPLE',
    roles: ['ROL-SYS-01'],
    reason: false,
    note: 'no asiste sin justificación',
  })),
  ...WORKER_OPERATIONAL.map((from) => ({
    from,
    to: 'PINK',
    roles: ['ROL-H-01', 'ROL-H-02', 'ROL-H-03'],
    reason: true,
    note: 'lo mandan a descansar',
  })),
  ...WORKER_OPERATIONAL.map((from) => ({
    from,
    to: 'RED',
    roles: ['ROL-H-01', 'ROL-H-02', 'ROL-H-03'],
    reason: true,
    note: 'el hotel lo reporta',
  })),
  ...WORKER_OPERATIONAL.map((from) => ({
    from,
    to: 'GRAY',
    roles: ['ROL-SYS-01'],
    reason: false,
    note: 'reporte de accidente laboral',
  })),
]

async function main(): Promise<void> {
  const log = (s: string): void => {
    process.stdout.write(s + '\n')
  }

  // --- roles ---
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, department: r.department },
      create: { id: uuidv7(), code: r.code, name: r.name, department: r.department },
    })
  }
  log(`roles: ${ROLES.length}`)

  // --- catálogos ---
  for (const d of HOTEL_DEPARTMENTS) {
    await prisma.hotelDepartment.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: { id: uuidv7(), code: d.code, name: d.name },
    })
  }
  log(`hotel_department: ${HOTEL_DEPARTMENTS.length}`)

  for (const p of POSITIONS) {
    const dept = await prisma.hotelDepartment.findUniqueOrThrow({ where: { code: p.department } })
    await prisma.catalogPosition.upsert({
      where: { code: p.code },
      update: { name: p.name, hotelDepartmentId: dept.id },
      create: { id: uuidv7(), code: p.code, name: p.name, hotelDepartmentId: dept.id },
    })
  }
  log(`catalogs.position: ${POSITIONS.length}`)

  for (const m of HIRING_MODALITIES) {
    await prisma.hiringModality.upsert({
      where: { code: m.code },
      update: { name: m.name },
      create: { id: uuidv7(), code: m.code, name: m.name },
    })
  }
  log(`hiring_modality: ${HIRING_MODALITIES.length}`)

  for (const e of ENGLISH_LEVELS) {
    await prisma.englishLevel.upsert({
      where: { code: e.code },
      update: { name: e.name, displayOrder: e.order },
      create: { id: uuidv7(), code: e.code, name: e.name, displayOrder: e.order },
    })
  }
  log(`english_level: ${ENGLISH_LEVELS.length}`)

  for (const z of ZONES) {
    await prisma.zone.upsert({
      where: { code: z.code },
      update: { name: z.name },
      create: { id: uuidv7(), code: z.code, name: z.name },
    })
  }
  log(`zone: ${ZONES.length}`)

  // --- semáforos y estados ---
  let states = 0
  for (const l of LIGHTS) {
    const light = await prisma.statusLight.upsert({
      where: { code: l.code },
      update: { name: l.name, description: l.description },
      create: { id: uuidv7(), code: l.code, name: l.name, description: l.description },
    })
    for (const [i, s] of l.states.entries()) {
      await prisma.statusLightState.upsert({
        where: { statusLightId_code: { statusLightId: light.id, code: s.code } },
        update: { color: s.color, name: s.name, displayOrder: i + 1, isBranch: s.branch ?? false },
        create: {
          id: uuidv7(),
          statusLightId: light.id,
          code: s.code,
          color: s.color,
          name: s.name,
          displayOrder: i + 1,
          isBranch: s.branch ?? false,
        },
      })
      states++
    }
  }
  log(`status_light: ${LIGHTS.length} · status_light_state: ${states}`)

  // --- transiciones del Onboarding ---
  const onboarding = await prisma.statusLight.findUniqueOrThrow({ where: { code: 'ONBOARDING' } })
  const stateId = async (code: string): Promise<string> =>
    (
      await prisma.statusLightState.findUniqueOrThrow({
        where: { statusLightId_code: { statusLightId: onboarding.id, code } },
      })
    ).id

  let transitions = 0
  for (const t of ONBOARDING_TRANSITIONS) {
    const fromId = await stateId(t.from)
    const toId = await stateId(t.to)
    for (const roleCode of t.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } })
      await prisma.statusLightTransition.upsert({
        where: {
          fromStateId_toStateId_authorizedRoleId: {
            fromStateId: fromId,
            toStateId: toId,
            authorizedRoleId: role.id,
          },
        },
        update: { requiresReason: t.reason },
        create: {
          id: uuidv7(),
          fromStateId: fromId,
          toStateId: toId,
          authorizedRoleId: role.id,
          requiresReason: t.reason,
          requiresEvidence: false,
        },
      })
      transitions++
    }
  }
  log(`status_light_transition (Onboarding): ${transitions}`)

  // --- transiciones del Semáforo del Colaborador ---
  const worker = await prisma.statusLight.findUniqueOrThrow({ where: { code: 'WORKER' } })
  const workerStateId = async (code: string): Promise<string> =>
    (
      await prisma.statusLightState.findUniqueOrThrow({
        where: { statusLightId_code: { statusLightId: worker.id, code } },
      })
    ).id

  let workerTransitions = 0
  let returnsToPrevious = 0
  for (const t of WORKER_TRANSITIONS) {
    const fromId = await workerStateId(t.from)
    const toId = t.to === null ? null : await workerStateId(t.to)

    for (const roleCode of t.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } })

      if (toId === null) {
        // No se puede usar el upsert por llave compuesta: to_state_id va NULL y
        // Prisma no acepta null en el where de una unique. El índice de la base
        // sí lo cubre (NULLS NOT DISTINCT), así que la idempotencia se resuelve
        // buscando primero.
        const existing = await prisma.statusLightTransition.findFirst({
          where: { fromStateId: fromId, toStateId: null, authorizedRoleId: role.id },
        })
        if (existing === null) {
          await prisma.statusLightTransition.create({
            data: {
              id: uuidv7(),
              fromStateId: fromId,
              toStateId: null,
              returnsToPrevious: true,
              authorizedRoleId: role.id,
              requiresReason: t.reason,
              requiresEvidence: false,
            },
          })
        }
        returnsToPrevious++
      } else {
        await prisma.statusLightTransition.upsert({
          where: {
            fromStateId_toStateId_authorizedRoleId: {
              fromStateId: fromId,
              toStateId: toId,
              authorizedRoleId: role.id,
            },
          },
          update: { requiresReason: t.reason },
          create: {
            id: uuidv7(),
            fromStateId: fromId,
            toStateId: toId,
            returnsToPrevious: false,
            authorizedRoleId: role.id,
            requiresReason: t.reason,
            requiresEvidence: false,
          },
        })
      }
      workerTransitions++
    }
  }
  log(
    `status_light_transition (Colaborador): ${workerTransitions}` +
      ` · de ellas ${returnsToPrevious} con destino variable`,
  )

  log('')
  log('PENDIENTE 1: las transiciones de los otros 5 semáforos. Sus estados están')
  log('sembrados, pero el vault no documenta qué movimientos son legales ni quién')
  log('los autoriza. Sin esas filas, esos semáforos no caminan.')
  log('')
  log('PENDIENTE 2: el Blacklist manual por falta grave. Blacklist.md dice que')
  log('cualquier rol de Reclutamiento puede vetar con motivo Y evidencia, pero el')
  log('Semáforo del Colaborador no lista esa transición y no dice desde qué')
  log('estados sale. Es el tercer camino a Negro y NO está sembrado.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e: unknown) => {
    await prisma.$disconnect()
    process.stderr.write(String(e) + '\n')
    process.exit(1)
  })
