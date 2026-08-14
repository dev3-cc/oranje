/**
 * La Matriz de Permisos, como filas.
 *
 * Sale de los tres `06 - Matriz de Permisos.md` del vault — Ventas, Hotel y
 * Reclutamiento. Cada entrada conserva la etiqueta en español del documento
 * original: es lo que permite auditar esta tabla contra su fuente sin adivinar
 * qué fila corresponde a cuál.
 *
 * Los identificadores van en inglés (D-11); las etiquetas, en español, porque
 * son el texto del vault citado.
 *
 * TRES COSAS QUE NO ESTÁN AQUÍ, Y POR QUÉ:
 *
 *   1. El rol Administrador. En las tres matrices aparece como ⏸️ EN PAUSA
 *      «mientras se estabilizan las reglas de negocio». Sembrarlo sería
 *      inventar permisos que el negocio no ha decidido.
 *   2. Los cuatro departamentos sin arquitectura — Inspección, QA, Customer
 *      Service y Contabilidad. Sus roles existen en `identity.role` y se quedan
 *      sin una sola fila aquí: no pueden hacer nada hasta que su matriz exista.
 *      Es la dirección segura del error.
 *   3. Blacklist › «Resolver disputa» y «Remover de Blacklist». La matriz de
 *      Reclutamiento las marca como del Inspector de zona y del Administrador,
 *      ninguno de los cuales es rol de ese departamento.
 *
 * Los IDs de rol se traducen a los de D-18: las matrices todavía usan
 * `ROL-V-03 Sistema` / `ROL-04 Sistema` / `ROL-H-04 Sistema`, que se unificaron
 * en ROL-SYS-01, y Reclutamiento usa `ROL-01…05` sin letra de departamento.
 */

export interface Permission {
  /** Módulo del sidebar, no el módulo de D-01. Es lo que la matriz agrupa. */
  module: string
  action: string
  /** La fila del vault, tal cual. Para poder auditar. */
  label: string
  roles: string[]
}

const BD = 'ROL-V-01'
const BDC = 'ROL-V-02'

const SUP = 'ROL-H-01'
const GA = 'ROL-H-02'
const GG = 'ROL-H-03'

const RECL = 'ROL-R-01'
const LIDER = 'ROL-R-02'
const MGR_R = 'ROL-R-03'

const SYS = 'ROL-SYS-01'

// ---------------------------------------------------------------------------
// VENTAS — Business Developer y Business Developer Coordinator
// ---------------------------------------------------------------------------
const VENTAS: Permission[] = [
  // PIPELINE
  {
    module: 'pipeline',
    action: 'read',
    label: 'Ver Pipeline (mi territorio)',
    roles: [BD, BDC, SYS],
  },
  { module: 'pipeline', action: 'read_all', label: 'Ver Pipeline global', roles: [BDC, SYS] },
  {
    module: 'pipeline',
    action: 'create_prospect',
    label: 'Identificar prospecto (Gris)',
    roles: [BD, BDC],
  },
  {
    module: 'pipeline',
    action: 'update_hotel_profile',
    label: 'Crear perfil del hotel (Azul Claro)',
    roles: [BD, BDC],
  },
  {
    module: 'pipeline',
    action: 'create_cold_visit',
    label: 'Registrar visita en frío',
    roles: [BD, BDC],
  },
  {
    module: 'pipeline',
    action: 'create_contact_attempt',
    label: 'Registrar intentos de contacto',
    roles: [BD, BDC],
  },
  {
    module: 'pipeline',
    action: 'advance_to_yellow',
    label: 'Avanzar a Amarillo (interés)',
    roles: [BD, BDC],
  },
  {
    module: 'pipeline',
    action: 'advance_to_pink',
    label: 'Iniciar negociación (Rosa)',
    roles: [BD, BDC],
  },
  { module: 'pipeline', action: 'mark_red', label: 'Marcar rechazo (Rojo)', roles: [BD] },
  { module: 'pipeline', action: 'reactivate_from_red', label: 'Reactivar desde Rojo', roles: [BD] },
  {
    module: 'pipeline',
    action: 'mark_brown',
    label: 'Marcar estancamiento (Café)',
    roles: [BD, BDC],
  },
  {
    module: 'pipeline',
    action: 'investigate_brown',
    label: 'Desbloquear estancamiento',
    roles: [BDC],
  },
  {
    module: 'pipeline',
    action: 'reactivate_from_brown',
    label: 'Reactivar desde Café',
    roles: [BDC],
  },
  { module: 'pipeline', action: 'mark_black', label: 'Marcar cliente Negro', roles: [BDC] },
  {
    module: 'pipeline',
    action: 'reactivate_from_black',
    label: 'Reactivar desde Negro',
    roles: [BDC],
  },

  // PROPUESTAS
  { module: 'proposals', action: 'read', label: 'Ver propuestas', roles: [BD, BDC, SYS] },
  { module: 'proposals', action: 'create', label: 'Elaborar Propuesta Personalizada', roles: [BD] },
  { module: 'proposals', action: 'send', label: 'Enviar propuesta al hotel', roles: [BD] },

  // DOCUMENTOS T&C
  {
    module: 'terms_and_conditions',
    action: 'read',
    label: 'Ver Documentos T&C',
    roles: [BD, BDC, SYS],
  },
  {
    module: 'terms_and_conditions',
    action: 'create',
    label: 'Crear Documento de T&C',
    roles: [BD, BDC],
  },
  {
    module: 'terms_and_conditions',
    action: 'update',
    label: 'Editar Documento de T&C',
    roles: [BD, BDC],
  },
  { module: 'terms_and_conditions', action: 'approve', label: 'Validar T&C', roles: [BDC] },

  // CONVERSIÓN — RR-V-01: solo el BDC aprueba
  {
    module: 'conversion',
    action: 'create_hotel_user',
    label: 'Crear Usuario del Hotel',
    roles: [BDC],
  },
  {
    module: 'conversion',
    action: 'approve',
    label: 'Aprobar conversión (Rosa → Naranja)',
    roles: [BDC],
  },
  {
    module: 'conversion',
    action: 'auto_trigger',
    label: 'Trigger Automático de Conversión',
    roles: [SYS],
  },
  {
    module: 'conversion',
    action: 'auto_advance_to_orange',
    label: 'Cambio automático a Naranja',
    roles: [SYS],
  },

  // MI TERRITORIO
  { module: 'territory', action: 'read', label: 'Ver mi territorio / rutas', roles: [BD, SYS] },
  {
    module: 'territory',
    action: 'read_prospects',
    label: 'Ver prospectos por ruta',
    roles: [BD, BDC, SYS],
  },
  {
    module: 'territory',
    action: 'read_all',
    label: 'Ver prospectos por ruta (todos)',
    roles: [BDC],
  },

  // MI EQUIPO
  { module: 'team', action: 'read_members', label: 'Ver BDs a cargo', roles: [BDC] },
  {
    module: 'team',
    action: 'read_member_metrics',
    label: 'Ver métricas individuales por BD',
    roles: [BDC, SYS],
  },
  { module: 'team', action: 'message_member', label: 'Comunicar con BD', roles: [BDC] },

  // CLIENTES ACTIVOS
  {
    module: 'active_clients',
    action: 'read',
    label: 'Ver clientes activos (referente)',
    roles: [BD, BDC, SYS],
  },

  // REPORTES
  { module: 'reports', action: 'create', label: 'Generar reporte de Ventas', roles: [BDC, SYS] },
  { module: 'reports', action: 'send', label: 'Enviar a dirección', roles: [BDC] },
  { module: 'reports', action: 'schedule', label: 'Programar envío recurrente', roles: [BDC] },
  {
    module: 'reports',
    action: 'read_history',
    label: 'Ver histórico de reportes',
    roles: [BDC, SYS],
  },

  // DASHBOARD
  { module: 'dashboard', action: 'read_own', label: 'Ver KPIs personales', roles: [BD, BDC, SYS] },
  {
    module: 'dashboard',
    action: 'read_department',
    label: 'Ver KPIs globales del depto',
    roles: [BDC, SYS],
  },

  // SISTEMA
  {
    module: 'system',
    action: 'receive_notification',
    label: 'Recibir notificación',
    roles: [BD, BDC, SYS],
  },
  {
    module: 'system',
    action: 'audit_status_change',
    label: 'Trazabilidad de cambios de status',
    roles: [SYS],
  },
  {
    module: 'system',
    action: 'send_notification',
    label: 'Enviar notificación automática',
    roles: [SYS],
  },
]

// ---------------------------------------------------------------------------
// HOTEL — Supervisor, Manager de Área y Manager General
// ---------------------------------------------------------------------------
const HOTEL: Permission[] = [
  // REQUISICIONES
  {
    module: 'requisitions',
    action: 'read_own',
    label: 'Ver mis requisiciones',
    roles: [SUP, GA, GG, SYS],
  },
  {
    module: 'requisitions',
    action: 'read_department',
    label: 'Ver vista global del hotel (solo su depto)',
    roles: [GA],
  },
  {
    module: 'requisitions',
    action: 'read_all',
    label: 'Ver vista global del hotel',
    roles: [GG, SYS],
  },
  { module: 'requisitions', action: 'create', label: 'Crear requisición', roles: [SUP, GA, GG] },
  {
    module: 'requisitions',
    action: 'update_draft',
    label: 'Editar borrador',
    roles: [SUP, GA, GG],
  },
  {
    module: 'requisitions',
    action: 'submit',
    label: 'Enviar a autorización',
    roles: [SUP, GA, GG],
  },
  { module: 'requisitions', action: 'authorize', label: 'Autorizar requisición', roles: [GA, GG] },
  {
    module: 'requisitions',
    action: 'reject',
    label: 'Rechazar con observaciones',
    roles: [GA, GG],
  },
  {
    module: 'requisitions',
    action: 'delete_empty',
    label: 'Eliminar requisición vacía',
    roles: [SUP, GA, GG, SYS],
  },
  {
    module: 'requisitions',
    action: 'delete_with_positions',
    label: 'Eliminar requisición con posiciones',
    roles: [GA, GG, SYS],
  },
  {
    module: 'requisitions',
    action: 'auto_calculate_urgency',
    label: 'Calcular Semáforo de Urgencia',
    roles: [SYS],
  },
  {
    module: 'requisitions',
    action: 'auto_assign_inspector',
    label: 'Asignar Inspector por zona',
    roles: [SYS],
  },
  { module: 'requisitions', action: 'comment', label: 'Comentar al expediente', roles: [GG] },
  {
    module: 'requisitions',
    action: 'escalate',
    label: 'Escalar requisición demorada',
    roles: [GG],
  },

  // SCHEDULE
  {
    module: 'schedule',
    action: 'read_department',
    label: 'Ver Schedule del depto',
    roles: [SUP, GA, GG, SYS],
  },
  {
    module: 'schedule',
    action: 'read_all',
    label: 'Ver Schedule global del hotel',
    roles: [GG, SYS],
  },
  { module: 'schedule', action: 'update', label: 'Editar Schedule semanal', roles: [GA, GG] },
  {
    module: 'schedule',
    action: 'auto_sync_positions',
    label: 'Reflejar posiciones autorizadas',
    roles: [SYS],
  },
  {
    module: 'schedule',
    action: 'suggest_reinforcement',
    label: 'Sugerir refuerzo de personal',
    roles: [SUP, GA],
  },
  { module: 'schedule', action: 'export', label: 'Exportar Schedule', roles: [SUP, GA, GG] },

  // TIMESHEET
  {
    module: 'timesheet',
    action: 'read_department',
    label: 'Ver Timesheet del depto',
    roles: [SUP, GA, GG, SYS],
  },
  {
    module: 'timesheet',
    action: 'read_all',
    label: 'Ver Timesheet global del hotel',
    roles: [GG, SYS],
  },
  {
    module: 'timesheet',
    action: 'review_punches',
    label: 'Revisar ponches y resolver anómalos',
    roles: [SUP, GA, GG, SYS],
  },
  // D-09: el corte entre operación y dinero. El Supervisor revisa, NO aprueba
  {
    module: 'timesheet',
    action: 'approve_hours',
    label: 'Aprobar horas trabajadas',
    roles: [GA, GG],
  },
  {
    module: 'timesheet',
    action: 'create_manual_punch',
    label: 'Registrar ponche manual',
    roles: [SUP, GA, GG],
  },
  { module: 'timesheet', action: 'correct_punch', label: 'Corregir ponche', roles: [GA, GG, SYS] },
  {
    module: 'timesheet',
    action: 'auto_calculate_compliance',
    label: 'Calcular Indicador de Cumplimiento',
    roles: [SYS],
  },
  {
    module: 'timesheet',
    action: 'auto_flag_extended_lunch',
    label: 'Ver Indicador de Lunch Extendido',
    roles: [SYS],
  },
  { module: 'timesheet', action: 'export', label: 'Exportar Timesheet', roles: [SUP, GA, GG] },

  // MI PERSONAL
  {
    module: 'staff',
    action: 'read',
    label: 'Ver colaboradores asignados',
    roles: [SUP, GA, GG, SYS],
  },
  {
    module: 'staff',
    action: 'set_standby',
    label: 'Poner en Stand-by (Rosa)',
    roles: [SUP, GA, GG],
  },
  { module: 'staff', action: 'report', label: 'Reportar colaborador (Rojo)', roles: [SUP, GA, GG] },
  {
    module: 'staff',
    action: 'read_history',
    label: 'Ver historial del colaborador',
    roles: [SUP, GA, GG, SYS],
  },

  // ACCIDENTES
  {
    module: 'work_accidents',
    action: 'read',
    label: 'Ver accidentes del depto',
    roles: [SUP, GA, GG, SYS],
  },
  {
    module: 'work_accidents',
    action: 'create_scenario_a',
    label: 'Crear tarjeta de accidente — Escenario A',
    roles: [SUP, GA, GG],
  },
  {
    module: 'work_accidents',
    action: 'create_scenario_b',
    label: 'Crear tarjeta de accidente — Escenario B',
    roles: [SUP, GA, GG],
  },
  {
    module: 'work_accidents',
    action: 'capture_evidence',
    label: 'Capturar evidencia presencial',
    roles: [SUP, GA, GG],
  },
  {
    module: 'work_accidents',
    action: 'auto_notify_inspector',
    label: 'Notificar al Inspector',
    roles: [SYS],
  },

  // MI EQUIPO DEL HOTEL
  {
    module: 'hotel_team',
    action: 'read_managers',
    label: 'Ver Gerentes de Departamento',
    roles: [GG],
  },
  {
    module: 'hotel_team',
    action: 'read_supervisors',
    label: 'Ver Supervisores del hotel',
    roles: [GG],
  },
  {
    module: 'hotel_team',
    action: 'message_member',
    label: 'Comunicar con Gerente / SUP',
    roles: [GG],
  },
  {
    module: 'hotel_team',
    action: 'request_report',
    label: 'Solicitar reporte específico',
    roles: [GG],
  },

  // REPORTES
  { module: 'reports', action: 'create', label: 'Generar reporte ejecutivo', roles: [GG, SYS] },
  { module: 'reports', action: 'send', label: 'Enviar a dirección', roles: [GG] },
  { module: 'reports', action: 'schedule', label: 'Programar envío recurrente', roles: [GG] },
  {
    module: 'reports',
    action: 'read_history',
    label: 'Ver histórico de reportes',
    roles: [GG, SYS],
  },

  // DASHBOARD
  {
    module: 'dashboard',
    action: 'read_own',
    label: 'Ver KPIs personales',
    roles: [SUP, GA, GG, SYS],
  },
  {
    module: 'dashboard',
    action: 'read_department',
    label: 'Ver KPIs del depto',
    roles: [GA, GG, SYS],
  },
  {
    module: 'dashboard',
    action: 'read_all',
    label: 'Ver KPIs globales del hotel',
    roles: [GG, SYS],
  },

  // SISTEMA
  {
    module: 'system',
    action: 'receive_notification',
    label: 'Recibir notificación',
    roles: [SUP, GA, GG, SYS],
  },
  {
    module: 'system',
    action: 'send_notification',
    label: 'Enviar notificación automática',
    roles: [SYS],
  },
  {
    module: 'system',
    action: 'auto_number_requisitions',
    label: 'Numeración automática de requisiciones',
    roles: [SYS],
  },
]

// ---------------------------------------------------------------------------
// RECLUTAMIENTO — Reclutadora, Líder de Grupo y Manager
// ---------------------------------------------------------------------------
const RECLUTAMIENTO: Permission[] = [
  // REQUISICIÓN
  {
    module: 'requisitions',
    action: 'read_authorized_queue',
    label: 'Ver cola de Autorizadas',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'requisitions',
    action: 'take',
    label: 'Tomar requisición (Self-Pick colaborativo)',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'requisitions',
    action: 'join',
    label: 'Tomar/Unirse a requisición ya tomada',
    roles: [RECL, LIDER, SYS],
  },
  {
    module: 'requisitions',
    action: 'leave',
    label: 'Salir de requisición tomada',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'requisitions',
    action: 'read_active_recruiters',
    label: 'Ver reclutadores activos',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'requisitions',
    action: 'read_history',
    label: 'Ver Historial de la requisición',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'requisitions',
    action: 'mark_in_progress',
    label: 'Marcar requisición en proceso',
    roles: [RECL, LIDER, SYS],
  },
  {
    module: 'requisitions',
    action: 'request_coverage_close',
    label: 'Marcar requisición como cubierta (solicita)',
    roles: [RECL],
  },
  {
    module: 'requisitions',
    action: 'approve_coverage_close',
    label: 'Marcar requisición como cubierta (cierre)',
    roles: [LIDER],
  },
  {
    module: 'requisitions',
    action: 'read_all',
    label: 'Ver vista global',
    roles: [LIDER, MGR_R, SYS],
  },
  {
    module: 'requisitions',
    action: 'assign_manually',
    label: 'Asignar manualmente (excepción)',
    roles: [MGR_R],
  },
  {
    module: 'requisitions',
    action: 'auto_calculate_urgency',
    label: 'Calcular Semáforo de Urgencia',
    roles: [SYS],
  },
  {
    module: 'requisitions',
    action: 'auto_calculate_positions',
    label: 'Calcular Semáforo de Posiciones',
    roles: [SYS],
  },
  {
    module: 'requisitions',
    action: 'force_status_change',
    label: 'Forzar cambio de semáforo',
    roles: [MGR_R, SYS],
  },

  // RECLUTAMIENTO
  {
    module: 'recruitment',
    action: 'read_pool',
    label: 'Ver Pool de Colaboradores',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'recruitment',
    action: 'search_candidates',
    label: 'Buscar / filtrar candidatos',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'recruitment',
    action: 'create_worker',
    label: 'Crear colaborador (alta Fase 1)',
    roles: [RECL, LIDER, MGR_R],
  },
  {
    module: 'recruitment',
    action: 'update_worker',
    label: 'Editar colaborador',
    roles: [RECL, LIDER, MGR_R],
  },
  {
    module: 'recruitment',
    action: 'validate_signup',
    label: 'Validar alta en app (Fase 2)',
    roles: [RECL, LIDER, SYS],
  },
  {
    module: 'recruitment',
    action: 'enable_access',
    label: 'Habilitar accesos',
    roles: [RECL, LIDER, SYS],
  },
  {
    module: 'recruitment',
    action: 'create_interview',
    label: 'Registrar entrevista',
    roles: [RECL, LIDER, SYS],
  },
  {
    module: 'recruitment',
    action: 'read_interviews',
    label: 'Ver historial de entrevistas',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'recruitment',
    action: 'assign_to_hotel',
    label: 'Asignar colaborador a hotel',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'recruitment',
    action: 'assign_to_schedule',
    label: 'Asignar al Schedule',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'recruitment',
    action: 'reassign_worker',
    label: 'Reasignar colaborador',
    roles: [RECL, LIDER, MGR_R],
  },
  {
    module: 'recruitment',
    action: 'unassign_worker',
    label: 'Desasignar colaborador',
    roles: [RECL, LIDER, MGR_R],
  },

  // BLACKLIST
  {
    module: 'blacklist',
    action: 'read',
    label: 'Consultar Blacklist',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'blacklist',
    action: 'create',
    label: 'Agregar a Blacklist',
    roles: [RECL, LIDER, MGR_R],
  },

  // MI GRUPO
  { module: 'group', action: 'read_members', label: 'Ver Reclutadoras del grupo', roles: [LIDER] },
  {
    module: 'group',
    action: 'read_member_metrics',
    label: 'Ver métricas individuales',
    roles: [LIDER, MGR_R, SYS],
  },
  {
    module: 'group',
    action: 'read_member_workload',
    label: 'Ver carga detallada de Reclutadora',
    roles: [LIDER],
  },
  {
    module: 'group',
    action: 'reassign_requisition',
    label: 'Reasignar requisición a Reclutadora',
    roles: [LIDER],
  },
  {
    module: 'group',
    action: 'set_member_availability',
    label: 'Marcar disponibilidad de Reclutadora',
    roles: [LIDER],
  },

  // MI EQUIPO
  { module: 'team', action: 'read_members', label: 'Ver Líderes + Reclutadoras', roles: [MGR_R] },
  {
    module: 'team',
    action: 'create_member',
    label: 'Dar de alta Líder/Reclutadora',
    roles: [MGR_R],
  },
  { module: 'team', action: 'update_member', label: 'Editar usuario del depto', roles: [MGR_R] },
  {
    module: 'team',
    action: 'move_member',
    label: 'Mover Reclutadora a otro Líder',
    roles: [MGR_R],
  },

  // INCIDENCIAS
  { module: 'incidents', action: 'resolve', label: 'Resolver incidencia', roles: [MGR_R] },
  {
    module: 'incidents',
    action: 'escalate_to_commercial',
    label: 'Escalar a comercial',
    roles: [LIDER, MGR_R],
  },

  // REPORTES
  {
    module: 'reports',
    action: 'create',
    label: 'Generar reporte del grupo',
    roles: [LIDER, MGR_R, SYS],
  },
  { module: 'reports', action: 'send', label: 'Enviar reporte al Manager', roles: [LIDER] },
  {
    module: 'reports',
    action: 'read_coverage_own',
    label: 'Ver cobertura individual',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'reports',
    action: 'read_coverage_zone',
    label: 'Ver cobertura por zona',
    roles: [LIDER, MGR_R, SYS],
  },
  {
    module: 'reports',
    action: 'read_coverage_all',
    label: 'Ver cobertura global',
    roles: [MGR_R, SYS],
  },

  // DASHBOARD
  {
    module: 'dashboard',
    action: 'read_own',
    label: 'Ver KPIs personales',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'dashboard',
    action: 'read_group',
    label: 'Ver KPIs de grupo',
    roles: [LIDER, MGR_R, SYS],
  },
  { module: 'dashboard', action: 'read_all', label: 'Ver KPIs globales', roles: [MGR_R, SYS] },

  // SISTEMA
  {
    module: 'system',
    action: 'receive_notification',
    label: 'Recibir notificación',
    roles: [RECL, LIDER, MGR_R, SYS],
  },
  {
    module: 'system',
    action: 'send_notification',
    label: 'Enviar notificación automática',
    roles: [SYS],
  },
]

export const PERMISSIONS: Permission[] = [...VENTAS, ...HOTEL, ...RECLUTAMIENTO]

/**
 * Aplana a filas de `identity.role_permission` y quita duplicados.
 *
 * Se duplican de verdad: `system.send_notification` aparece en las tres
 * matrices para el mismo rol Sistema, y `dashboard.read_own` en las tres para
 * roles distintos. Sin esta pasada, el índice único de la tabla rechaza el seed
 * a media corrida.
 */
export function flattenPermissions(): Array<{ roleCode: string; module: string; action: string }> {
  const vistas = new Set<string>()
  const filas: Array<{ roleCode: string; module: string; action: string }> = []

  for (const p of PERMISSIONS) {
    for (const roleCode of p.roles) {
      const clave = `${roleCode}|${p.module}|${p.action}`

      if (!vistas.has(clave)) {
        vistas.add(clave)
        filas.push({ roleCode, module: p.module, action: p.action })
      }
    }
  }

  return filas
}
