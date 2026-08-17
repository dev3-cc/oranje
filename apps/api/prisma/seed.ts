import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { flattenPermissions } from './permissions.js'

/**
 * Seed de catálogos. Las reglas del negocio son FILAS, no código: sin esto el
 * esquema existe y el negocio no funciona. Todo sale del vault.
 *
 * Idempotente: cada fila se identifica por su `code` y se hace upsert.
 * El `id` es uuid v7 generado aquí porque `gen_random_uuid()` devuelve v4.
 */

// Corre como el migrador. Cae a DATABASE_URL solo para no romper donde el
// usuario no se haya separado.
const adapter = new PrismaPg({
  connectionString: process.env['MIGRATE_DATABASE_URL'] ?? process.env['DATABASE_URL'],
})
const prisma = new PrismaClient({ adapter })

// ---------------------------------------------------------------------------
// Roles. El rol operativo de base es 01 y de ahí hacia arriba.
// Sistema y Administrador son transversales (ROL-SYS-01, ROL-ADM-01): uno por
// departamento triplicaría sus permisos en role_permission.
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
// Catálogos. Posiciones y Zonas no son exhaustivas: se siembra lo documentado y
// el negocio agrega el resto desde la aplicación.
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
// Los 7 semáforos y sus estados. El `code` en inglés y el `name` en español
// (D-11); los hex viven en Convenciones de Diseño, no aquí.
// `branch` marca los estados que son rama y no paso del avance normal.
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
// Transiciones del Semáforo Onboarding.
//
// Cualquier par que no esté aquí es un 409, no un estado alcanzable.
// `reason` no viene del vault: el criterio es que lo exige toda transición que
// cierra o desbloquea un ciclo.
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
 * Los 4 estados en los que el colaborador TIENE asignación activa. Derivado de
 * `Reglas de Negocio`, que excluye Rosa y Amarillo por no tenerla.
 *
 * Las cuatro transiciones de incidencia solo pueden salir de aquí: no se falta
 * sin Schedule, y el accidente laboral ocurre trabajando.
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

// ---------------------------------------------------------------------------
// Motivos de cambio de estado. 33 transiciones exigen motivo, así que sin estas
// filas el servicio devuelve 422 y esos pasos no se pueden dar.
// La lista es abierta: el negocio agrega los que falten desde la aplicación.
// ---------------------------------------------------------------------------
const CHANGE_REASONS: Array<{ light: string; code: string; name: string }> = [
  // Rosa · Stand-by
  { light: 'WORKER', code: 'VACATION', name: 'Vacaciones' },
  { light: 'WORKER', code: 'LOW_SEASON', name: 'Temporada baja' },

  // Rojo · Reportado — las dos causas del reporte
  { light: 'WORKER', code: 'ABSENCES', name: 'Inasistencias' },
  { light: 'WORKER', code: 'SERIOUS_MISCONDUCT', name: 'Falta grave en el hotel' },

  // La resolución del Inspector
  { light: 'WORKER', code: 'DISPUTE_FOR_HOTEL', name: 'Disputa resuelta a favor del hotel' },
  { light: 'WORKER', code: 'DISPUTE_FOR_WORKER', name: 'Disputa resuelta a favor del colaborador' },

  // Onboarding
  { light: 'ONBOARDING', code: 'HOTEL_CLOSED', name: 'Cierre del hotel' },
  { light: 'ONBOARDING', code: 'MANAGEMENT_CHANGE', name: 'Cambio de administración' },
  { light: 'ONBOARDING', code: 'OPERATION_PAUSED', name: 'Pausa temporal de operación' },
  { light: 'ONBOARDING', code: 'COMMERCIAL_DISPUTE', name: 'Disputa comercial' },
]

// ---------------------------------------------------------------------------
// Transiciones de Requisición y Calidad.
//
// Solo 4 de los 7 semáforos necesitan filas aquí. Posiciones, Urgencia y
// Cumplimiento del Timesheet son DERIVADOS —los recalcula un job al cruzar un
// umbral—, y esta tabla es para pasos que una persona pide.
// ---------------------------------------------------------------------------
const OTHER_TRANSITIONS: Array<{
  light: string
  from: string
  to: string
  roles: string[]
  reason: boolean
  note?: string
}> = [
  // --- Semáforo de Requisición ---
  // El Supervisor la crea pero NO la autoriza: por eso no está aquí.
  {
    light: 'REQUISITION',
    from: 'APPLE_GREEN',
    to: 'GREEN',
    roles: ['ROL-H-02', 'ROL-H-03'],
    reason: false,
    note: 'autoriza el GH o el GM',
  },
  // La toma de la bandeja compartida — el Self-Pick, RR-15.
  {
    light: 'REQUISITION',
    from: 'GREEN',
    to: 'YELLOW',
    roles: ['ROL-R-01', 'ROL-R-02'],
    reason: false,
    note: 'la toma de la bandeja',
  },
  // Regresa a Autorizada cuando sale el ÚLTIMO participante. No lo decide una
  // persona: lo deduce el sistema contando participation con left_at nulo.
  {
    light: 'REQUISITION',
    from: 'YELLOW',
    to: 'GREEN',
    roles: ['ROL-SYS-01'],
    reason: false,
    note: 'salio el ultimo reclutador (RR-15)',
  },
  {
    light: 'REQUISITION',
    from: 'YELLOW',
    to: 'LIGHT_BLUE',
    roles: ['ROL-R-01', 'ROL-R-02'],
    reason: false,
    note: 'cerro al 100%',
  },
  {
    light: 'REQUISITION',
    from: 'YELLOW',
    to: 'RED',
    roles: ['ROL-R-01', 'ROL-R-02'],
    reason: true,
    note: 'cerro con cobertura incompleta',
  },

  // --- Indicador de Calidad ---
  // Autoriza el MANAGER de QA, no el Operador, que solo propone: la transición
  // se efectúa al aprobar. Verde es el estado inicial y no lleva fila.
  {
    light: 'QUALITY',
    from: 'GREEN',
    to: 'YELLOW',
    roles: ['ROL-Q-02'],
    reason: true,
    note: 'metricas fuera de rango u observaciones sin atender',
  },
  {
    light: 'QUALITY',
    from: 'YELLOW',
    to: 'RED',
    roles: ['ROL-Q-02'],
    reason: true,
    note: 'las observaciones persisten',
  },
  {
    light: 'QUALITY',
    from: 'RED',
    to: 'YELLOW',
    roles: ['ROL-Q-02'],
    reason: false,
    note: 'el depto empieza a atender',
  },
  {
    light: 'QUALITY',
    from: 'YELLOW',
    to: 'GREEN',
    roles: ['ROL-Q-02'],
    reason: false,
    note: 'todo resuelto, metricas en parametros',
  },
]

// ---------------------------------------------------------------------------
// Blacklist: la entrada manual y la salida.
//
// ENTRADA: falta grave, con motivo Y evidencia. Sale de CUALQUIER estado, no
// solo de los operativos — hasta alguien en Blanco puede quedar vetado.
//
// SALIDA: la autoriza el Administrador y regresa a BLANCO, no a Verde fuerte,
// porque la Reclutadora lo revalida antes de que vuelva a ser asignable.
// ---------------------------------------------------------------------------
const WORKER_STATES_ALL = [
  'WHITE',
  'APPLE_GREEN',
  'LIGHT_BLUE',
  'ORANGE',
  'STRONG_GREEN',
  'YELLOW',
  'BROWN',
  'PINK',
  'PURPLE',
  'RED',
  'GRAY',
]

const BLACKLIST_TRANSITIONS: Array<{
  from: string
  to: string
  roles: string[]
  reason: boolean
  evidence: boolean
}> = [
  // Desde los 11 estados que no son Negro, por los 3 roles de Reclutamiento.
  ...WORKER_STATES_ALL.map((from) => ({
    from,
    to: 'BLACK',
    roles: ['ROL-R-01', 'ROL-R-02', 'ROL-R-03'],
    reason: true,
    evidence: true,
  })),
  // La salida. Un solo rol y motivo obligatorio: no es automática.
  { from: 'BLACK', to: 'WHITE', roles: ['ROL-ADM-01'], reason: true, evidence: false },
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

  // --- Matriz de Permisos ---
  // Un rol sin filas aquí no puede hacer nada: los cuatro departamentos sin
  // arquitectura quedan negados por omisión, que es la dirección segura.
  const permissions = flattenPermissions()
  const current = new Set<string>()

  for (const p of permissions) {
    const rol = await prisma.role.findUniqueOrThrow({ where: { code: p.roleCode } })
    current.add(`${rol.id}|${p.module}|${p.action}`)

    await prisma.rolePermission.upsert({
      where: {
        roleId_module_action: { roleId: rol.id, module: p.module, action: p.action },
      },
      update: {},
      create: { id: uuidv7(), roleId: rol.id, module: p.module, action: p.action },
    })
  }

  // La Matriz es la fuente de verdad, así que también QUITA. Sin esto, un
  // permiso que el negocio revoca se queda vivo para siempre: solo con upsert,
  // `generate_qr` sobrevivió a que el ponche dejara de usar QR.
  const stale = (
    await prisma.rolePermission.findMany({
      select: { id: true, roleId: true, module: true, action: true },
    })
  ).filter((p) => !current.has(`${p.roleId}|${p.module}|${p.action}`))

  if (stale.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { id: { in: stale.map((p) => p.id) } } })
  }

  log(`role_permission: ${permissions.length} vigentes · ${stale.length} revocados`)

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
          // Desnormalizado para fijar el semáforo con un CHECK: el uuid lo genera
          // este seed y cambia por ambiente, el code no.
          statusLightCode: light.code,
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

  // --- motivos de cambio de estado ---
  for (const r of CHANGE_REASONS) {
    const light = await prisma.statusLight.findUniqueOrThrow({ where: { code: r.light } })
    const found = await prisma.statusChangeReason.findFirst({
      where: { statusLightId: light.id, code: r.code },
    })
    if (found === null) {
      await prisma.statusChangeReason.create({
        data: { id: uuidv7(), statusLightId: light.id, code: r.code, name: r.name },
      })
    }
  }
  log(`status_change_reason: ${CHANGE_REASONS.length}`)

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
          statusLightId: onboarding.id,
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
        // Sin upsert por llave compuesta: to_state_id va NULL y Prisma no acepta
        // null en el where de una unique. La idempotencia se resuelve buscando
        // primero; el índice de la base sí lo cubre con NULLS NOT DISTINCT.
        const existing = await prisma.statusLightTransition.findFirst({
          where: { fromStateId: fromId, toStateId: null, authorizedRoleId: role.id },
        })
        if (existing === null) {
          await prisma.statusLightTransition.create({
            data: {
              id: uuidv7(),
              statusLightId: worker.id,
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
            statusLightId: worker.id,
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

  // --- transiciones de Requisición y Calidad ---
  let otherTransitions = 0
  for (const t of OTHER_TRANSITIONS) {
    const light = await prisma.statusLight.findUniqueOrThrow({ where: { code: t.light } })
    const from = await prisma.statusLightState.findUniqueOrThrow({
      where: { statusLightId_code: { statusLightId: light.id, code: t.from } },
    })
    const to = await prisma.statusLightState.findUniqueOrThrow({
      where: { statusLightId_code: { statusLightId: light.id, code: t.to } },
    })
    for (const roleCode of t.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } })
      await prisma.statusLightTransition.upsert({
        where: {
          fromStateId_toStateId_authorizedRoleId: {
            fromStateId: from.id,
            toStateId: to.id,
            authorizedRoleId: role.id,
          },
        },
        update: { requiresReason: t.reason },
        create: {
          id: uuidv7(),
          statusLightId: light.id,
          fromStateId: from.id,
          toStateId: to.id,
          returnsToPrevious: false,
          authorizedRoleId: role.id,
          requiresReason: t.reason,
          requiresEvidence: false,
        },
      })
      otherTransitions++
    }
  }
  log(`status_light_transition (Requisición y Calidad): ${otherTransitions}`)

  // --- Blacklist: entrada abierta y salida ---
  let blacklistTransitions = 0
  for (const t of BLACKLIST_TRANSITIONS) {
    const from = await workerStateId(t.from)
    const to = await workerStateId(t.to)
    for (const roleCode of t.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } })
      await prisma.statusLightTransition.upsert({
        where: {
          fromStateId_toStateId_authorizedRoleId: {
            fromStateId: from,
            toStateId: to,
            authorizedRoleId: role.id,
          },
        },
        update: { requiresReason: t.reason, requiresEvidence: t.evidence },
        create: {
          id: uuidv7(),
          statusLightId: worker.id,
          fromStateId: from,
          toStateId: to,
          returnsToPrevious: false,
          authorizedRoleId: role.id,
          requiresReason: t.reason,
          requiresEvidence: t.evidence,
        },
      })
      blacklistTransitions++
    }
  }
  log(`status_light_transition (Blacklist): ${blacklistTransitions}`)

  log('')
  log('NOTA: 4 de los 7 semáforos tienen transiciones. Los otros tres —Posiciones,')
  log('Urgencia y Cumplimiento del Timesheet— son DERIVADOS: nadie pide pasar a')
  log('Rojo, se pasa solo cuando la cobertura, las horas restantes o las horas')
  log('trabajadas cruzan un umbral. No necesitan filas aquí; los recalcula un job.')
  log('')
  log('PENDIENTE 1: el Indicador de Calidad tiene un flujo PROPONER -> APROBAR que')
  log('este modelo no sabe expresar. El vault dice que el Operador de QA propone y')
  log('el Manager valida; aquí solo quedó el Manager, porque la transición se')
  log('efectúa al aprobar. Falta decidir si la propuesta es un estado o una tabla.')
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
