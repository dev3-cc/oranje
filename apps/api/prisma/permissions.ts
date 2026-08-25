/**
 * La Matriz de Permisos, como filas.
 *
 * Sale de los tres `06 - Matriz de Permisos.md` del vault — Ventas, Hotel y
 * Reclutamiento — más las de Contabilidad, que no tiene matriz y se derivaron
 * de `Flujo de Nómina`. Cada entrada conserva la etiqueta en español del documento
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
 *   2. Tres de los cuatro departamentos sin arquitectura — Inspección, QA y
 *      Customer Service. Sus roles existen en `identity.role` y se quedan sin
 *      una sola fila aquí: no pueden hacer nada hasta que su matriz exista. Es
 *      la dirección segura del error.
 *      Contabilidad SÍ tiene filas desde el 2026-08-18, derivadas de
 *      `Flujo de Nómina` porque el Consolidado necesitaba autorización y el
 *      flujo sí dice quién valida y quién autoriza. Se marcan aparte para que
 *      se revisen cuando su matriz exista.
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

const SUPERVISOR = 'ROL-H-01'
const GA = 'ROL-H-02'
const GG = 'ROL-H-03'

const RECRUITER = 'ROL-R-01'
const GROUP_LEAD = 'ROL-R-02'
const RECRUITMENT_MANAGER = 'ROL-R-03'
const ADMIN = 'ROL-ADM-01'
const ACCOUNTANT = 'ROL-CO-01'
const ACCOUNTING_MANAGER = 'ROL-CO-02'

const WORKER = 'ROL-C-01'

const INSPECTOR = 'ROL-I-01'

const SYS = 'ROL-SYS-01'

// ---------------------------------------------------------------------------
// VENTAS — Business Developer y Business Developer Coordinator
// ---------------------------------------------------------------------------
const SALES: Permission[] = [
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
  {
    module: 'pipeline',
    action: 'close_cycle',
    label: 'Archivar ciclo comercial',
    roles: [BD, BDC],
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
    action: 'assign',
    label: 'Asignar territorio a un BD',
    roles: [BDC, ADMIN],
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
    roles: [SUPERVISOR, GA, GG, SYS],
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
  {
    module: 'requisitions',
    action: 'create',
    label: 'Crear requisición',
    roles: [SUPERVISOR, GA, GG],
  },
  {
    module: 'requisitions',
    action: 'update_draft',
    label: 'Editar borrador',
    roles: [SUPERVISOR, GA, GG],
  },
  {
    module: 'requisitions',
    action: 'submit',
    label: 'Enviar a autorización',
    roles: [SUPERVISOR, GA, GG],
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
    roles: [SUPERVISOR, GA, GG, SYS],
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
    roles: [SUPERVISOR, GA, GG, SYS],
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
    roles: [SUPERVISOR, GA],
  },
  { module: 'schedule', action: 'export', label: 'Exportar Schedule', roles: [SUPERVISOR, GA, GG] },

  // TIMESHEET
  {
    module: 'timesheet',
    action: 'read_department',
    label: 'Ver Timesheet del depto',
    roles: [SUPERVISOR, GA, GG, SYS],
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
    roles: [SUPERVISOR, GA, GG, SYS],
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
    roles: [SUPERVISOR, GA, GG],
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
  {
    module: 'timesheet',
    action: 'export',
    label: 'Exportar Timesheet',
    roles: [SUPERVISOR, GA, GG],
  },

  // MI PERSONAL
  {
    module: 'staff',
    action: 'read',
    label: 'Ver colaboradores asignados',
    roles: [SUPERVISOR, GA, GG, SYS],
  },
  {
    module: 'staff',
    action: 'set_standby',
    label: 'Poner en Stand-by (Rosa)',
    roles: [SUPERVISOR, GA, GG],
  },
  {
    module: 'staff',
    action: 'report',
    label: 'Reportar colaborador (Rojo)',
    roles: [SUPERVISOR, GA, GG],
  },
  {
    module: 'staff',
    action: 'read_history',
    label: 'Ver historial del colaborador',
    roles: [SUPERVISOR, GA, GG, SYS],
  },

  // ACCIDENTES
  {
    module: 'work_accidents',
    action: 'read',
    label: 'Ver accidentes del depto',
    roles: [SUPERVISOR, GA, GG, SYS],
  },
  {
    module: 'work_accidents',
    action: 'create_scenario_a',
    label: 'Crear tarjeta de accidente — Escenario A',
    roles: [SUPERVISOR, GA, GG],
  },
  {
    module: 'work_accidents',
    action: 'create_scenario_b',
    label: 'Crear tarjeta de accidente — Escenario B',
    roles: [SUPERVISOR, GA, GG],
  },
  {
    module: 'work_accidents',
    action: 'capture_evidence',
    label: 'Capturar evidencia presencial',
    roles: [SUPERVISOR, GA, GG],
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
    roles: [SUPERVISOR, GA, GG, SYS],
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
    roles: [SUPERVISOR, GA, GG, SYS],
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
const RECRUITMENT: Permission[] = [
  // REQUISICIÓN
  {
    module: 'requisitions',
    action: 'read_authorized_queue',
    label: 'Ver cola de Autorizadas',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'requisitions',
    action: 'take',
    label: 'Tomar requisición (Self-Pick colaborativo)',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'requisitions',
    action: 'join',
    label: 'Tomar/Unirse a requisición ya tomada',
    roles: [RECRUITER, GROUP_LEAD, SYS],
  },
  {
    module: 'requisitions',
    action: 'leave',
    label: 'Salir de requisición tomada',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'requisitions',
    action: 'read_active_recruiters',
    label: 'Ver reclutadores activos',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'requisitions',
    action: 'read_history',
    label: 'Ver Historial de la requisición',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'requisitions',
    action: 'mark_in_progress',
    label: 'Marcar requisición en proceso',
    roles: [RECRUITER, GROUP_LEAD, SYS],
  },
  {
    module: 'requisitions',
    action: 'request_coverage_close',
    label: 'Marcar requisición como cubierta (solicita)',
    roles: [RECRUITER],
  },
  {
    module: 'requisitions',
    action: 'approve_coverage_close',
    label: 'Marcar requisición como cubierta (cierre)',
    roles: [GROUP_LEAD],
  },
  {
    module: 'requisitions',
    action: 'read_all',
    label: 'Ver vista global',
    roles: [GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'requisitions',
    action: 'assign_manually',
    label: 'Asignar manualmente (excepción)',
    roles: [RECRUITMENT_MANAGER],
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
    roles: [RECRUITMENT_MANAGER, SYS],
  },

  // RECLUTAMIENTO
  {
    module: 'recruitment',
    action: 'read_pool',
    label: 'Ver Pool de Colaboradores',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'recruitment',
    action: 'search_candidates',
    label: 'Buscar / filtrar candidatos',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'recruitment',
    action: 'create_worker',
    label: 'Crear colaborador (alta Fase 1)',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER],
  },
  {
    module: 'recruitment',
    action: 'update_worker',
    label: 'Editar colaborador',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER],
  },
  {
    module: 'recruitment',
    action: 'validate_signup',
    label: 'Validar alta en app (Fase 2)',
    roles: [RECRUITER, GROUP_LEAD, SYS],
  },
  {
    module: 'recruitment',
    action: 'enable_access',
    label: 'Habilitar accesos',
    roles: [RECRUITER, GROUP_LEAD, SYS],
  },
  {
    module: 'recruitment',
    action: 'create_interview',
    label: 'Registrar entrevista',
    roles: [RECRUITER, GROUP_LEAD, SYS],
  },
  {
    module: 'recruitment',
    action: 'read_interviews',
    label: 'Ver historial de entrevistas',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'recruitment',
    action: 'assign_to_hotel',
    label: 'Asignar colaborador a hotel',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'recruitment',
    action: 'assign_to_schedule',
    label: 'Asignar al Schedule',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'recruitment',
    action: 'reassign_worker',
    label: 'Reasignar colaborador',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER],
  },
  {
    module: 'recruitment',
    action: 'unassign_worker',
    label: 'Desasignar colaborador',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER],
  },

  // BLACKLIST
  {
    module: 'blacklist',
    action: 'read',
    label: 'Consultar Blacklist',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'blacklist',
    action: 'create',
    label: 'Agregar a Blacklist',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER],
  },

  // MI GRUPO
  {
    module: 'group',
    action: 'read_members',
    label: 'Ver Reclutadoras del grupo',
    roles: [GROUP_LEAD],
  },
  {
    module: 'group',
    action: 'read_member_metrics',
    label: 'Ver métricas individuales',
    roles: [GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'group',
    action: 'read_member_workload',
    label: 'Ver carga detallada de Reclutadora',
    roles: [GROUP_LEAD],
  },
  {
    module: 'group',
    action: 'reassign_requisition',
    label: 'Reasignar requisición a Reclutadora',
    roles: [GROUP_LEAD],
  },
  {
    module: 'group',
    action: 'set_member_availability',
    label: 'Marcar disponibilidad de Reclutadora',
    roles: [GROUP_LEAD],
  },

  // MI EQUIPO
  {
    module: 'team',
    action: 'read_members',
    label: 'Ver Líderes + Reclutadoras',
    roles: [RECRUITMENT_MANAGER],
  },
  {
    module: 'team',
    action: 'create_member',
    label: 'Dar de alta Líder/Reclutadora',
    roles: [RECRUITMENT_MANAGER],
  },
  {
    module: 'team',
    action: 'update_member',
    label: 'Editar usuario del depto',
    roles: [RECRUITMENT_MANAGER],
  },
  {
    module: 'team',
    action: 'move_member',
    label: 'Mover Reclutadora a otro Líder',
    roles: [RECRUITMENT_MANAGER],
  },

  // INCIDENCIAS
  {
    module: 'incidents',
    action: 'resolve',
    label: 'Resolver incidencia',
    roles: [RECRUITMENT_MANAGER],
  },
  {
    module: 'incidents',
    action: 'escalate_to_commercial',
    label: 'Escalar a comercial',
    roles: [GROUP_LEAD, RECRUITMENT_MANAGER],
  },

  // REPORTES
  {
    module: 'reports',
    action: 'create',
    label: 'Generar reporte del grupo',
    roles: [GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  { module: 'reports', action: 'send', label: 'Enviar reporte al Manager', roles: [GROUP_LEAD] },
  {
    module: 'reports',
    action: 'read_coverage_own',
    label: 'Ver cobertura individual',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'reports',
    action: 'read_coverage_zone',
    label: 'Ver cobertura por zona',
    roles: [GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'reports',
    action: 'read_coverage_all',
    label: 'Ver cobertura global',
    roles: [RECRUITMENT_MANAGER, SYS],
  },

  // DASHBOARD
  {
    module: 'dashboard',
    action: 'read_own',
    label: 'Ver KPIs personales',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'dashboard',
    action: 'read_group',
    label: 'Ver KPIs de grupo',
    roles: [GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'dashboard',
    action: 'read_all',
    label: 'Ver KPIs globales',
    roles: [RECRUITMENT_MANAGER, SYS],
  },

  // SISTEMA
  {
    module: 'system',
    action: 'receive_notification',
    label: 'Recibir notificación',
    roles: [RECRUITER, GROUP_LEAD, RECRUITMENT_MANAGER, SYS],
  },
  {
    module: 'system',
    action: 'send_notification',
    label: 'Enviar notificación automática',
    roles: [SYS],
  },
]

// ---------------------------------------------------------------------------
// CONTABILIDAD — Contadora y Manager de Contabilidad
//
// Sin Matriz de Permisos en Arquitecturas/: el departamento no tiene carpeta.
// Estas filas se derivan de `Flujo de Nomina`, que si dice quien hace que — la
// Contadora valida, el Manager de Contabilidad autoriza —, y coinciden con las
// dos firmas que ck_consolidation_signatures ya exige en la base.
// ---------------------------------------------------------------------------
// El levantamiento del veto no esta en la matriz de Reclutamiento: el propio
// encabezado explica que «Remover de Blacklist» quedo fuera por ser del
// Administrador, que no es rol de ese departamento. La fila se deriva de
// `Core/Modulos/Blacklist` —«solo por un perfil de Administrador», 2026-08-13— y
// coincide con la unica transicion BLACK -> WHITE sembrada, autorizada a ROL-ADM-01.
const ADMINISTRATION: Permission[] = [
  {
    module: 'blacklist',
    action: 'lift',
    label: 'Remover de Blacklist',
    roles: [ADMIN],
  },
]

const ACCOUNTING: Permission[] = [
  {
    module: 'payroll',
    action: 'read',
    label: 'Ver el Consolidado Semanal',
    roles: [ACCOUNTANT, ACCOUNTING_MANAGER, SYS],
  },
  {
    module: 'payroll',
    action: 'generate',
    label: 'Generar el Consolidado de la semana',
    roles: [ACCOUNTANT, ACCOUNTING_MANAGER, SYS],
  },
  {
    module: 'payroll',
    action: 'validate',
    label: 'Validar el Pre-Payroll',
    roles: [ACCOUNTANT],
  },
  {
    module: 'payroll',
    action: 'authorize',
    label: 'Autorizar y liberar la nomina',
    roles: [ACCOUNTING_MANAGER],
  },
  {
    module: 'payroll',
    action: 'mark_paid',
    label: 'Registrar el pago',
    roles: [ACCOUNTING_MANAGER, SYS],
  },
  {
    module: 'payroll',
    action: 'manage_deductions',
    label: 'Aplicar y reembolsar deducciones',
    roles: [ACCOUNTANT, ACCOUNTING_MANAGER],
  },
]

/**
 * ROL-C-01 Colaborador. Sale de `Arquitecturas/Colaborador/04 - Permisos
 * Detallados.md`, que no es una Matriz de departamento —el Colaborador es un
 * rol suelto— pero cumple la misma funcion y es igual de explicita: trae una
 * seccion de lo que NO puede.
 *
 * Todo su alcance es `_own`: RR-C-01 dice que no ve datos de ningun otro
 * colaborador. El alcance no vive aqui sino en la persona (D-09), y para el
 * Colaborador es el vinculo `identity.user.id` con `personal.worker`.
 *
 * Dos desviaciones frente al documento, ambas por el ponche:
 *  - dice "Escanear QR y ponchar (6 ponches)", pero D-21 dejo cuatro marcas con
 *    GPS y foto. El permiso queda como `timesheet:punch`, que es lo que el
 *    endpoint existente exige.
 *  - "Generar QR" no se transcribe: ese permiso ya se revoco cuando el ponche
 *    dejo de usar QR.
 */
const WORKER_ROLE: Permission[] = [
  {
    module: 'worker',
    action: 'complete_signup',
    label: 'Completar el alta — Fases 2 y 3',
    roles: [WORKER],
  },
  {
    module: 'worker',
    action: 'read_own',
    label: 'Ver su perfil, su estado y su semaforo',
    roles: [WORKER],
  },
  {
    module: 'worker',
    action: 'update_own_contact',
    label: 'Editar sus datos de contacto y de emergencia',
    roles: [WORKER],
  },
  {
    module: 'worker',
    action: 'set_availability',
    label: 'Activar y desactivar su disponibilidad voluntaria (RR-C-02)',
    roles: [WORKER],
  },
  {
    module: 'timesheet',
    action: 'punch',
    label: 'Ponchar',
    roles: [WORKER],
  },
  {
    module: 'schedule',
    action: 'read_own',
    label: 'Ver su Schedule de la semana',
    roles: [WORKER],
  },
  {
    module: 'timesheet',
    action: 'read_own',
    label: 'Ver sus horas brutas, la deduccion de lunch y las netas',
    roles: [WORKER],
  },
  {
    module: 'payroll',
    action: 'read_own',
    label: 'Ver los pagos ya liberados — nunca el que esta en curso (RR-C-05)',
    roles: [WORKER],
  },
  {
    module: 'accident',
    action: 'report_own',
    label: 'Reportar un accidente laboral desde la app (RF-C-05)',
    roles: [WORKER],
  },
  {
    module: 'notification',
    action: 'read_own',
    label: 'Ver sus notificaciones',
    roles: [WORKER],
  },
  {
    module: 'system',
    action: 'receive_notification',
    label: 'Recibir notificaciones push',
    roles: [WORKER],
  },
]

/**
 * Accidente Laboral. **Inspeccion no tiene Matriz de Permisos** —no tiene
 * carpeta en `Arquitecturas/`—, asi que estas cuatro filas se derivaron del
 * `Flujo de Accidente Laboral` y de `Reglas de Negocio`. Es el mismo caso que
 * las seis de `payroll` y `blacklist:lift`: sembradas sin matriz y marcadas
 * para revision.
 *
 * `accident:report_own` no va aqui: es del Colaborador y sale de su
 * `04 - Permisos Detallados`, que si existe.
 */
const INSPECTION: Permission[] = [
  {
    module: 'accident',
    action: 'read',
    label: 'Ver tarjetas de accidente',
    roles: [SUPERVISOR, GA, GG, INSPECTOR, SYS],
  },
  {
    module: 'accident',
    action: 'report',
    label: 'Reportar un accidente de un colaborador (escenario B)',
    roles: [SUPERVISOR, GA, GG],
  },
  {
    module: 'accident',
    action: 'capture_on_site',
    label: 'Capturar la informacion presencial',
    roles: [SUPERVISOR],
  },
  {
    module: 'accident',
    action: 'medical_follow_up',
    label: 'Capturar el seguimiento medico',
    roles: [INSPECTOR],
  },
  {
    module: 'accident',
    action: 'close',
    label: 'Cerrar la tarjeta con alta medica',
    roles: [INSPECTOR],
  },
]

export const PERMISSIONS: Permission[] = [
  ...SALES,
  ...HOTEL,
  ...RECRUITMENT,
  ...ACCOUNTING,
  ...ADMINISTRATION,
  ...WORKER_ROLE,
  ...INSPECTION,
]

/**
 * Aplana a filas de `identity.role_permission` y quita duplicados.
 *
 * Se duplican de verdad: `system.send_notification` aparece en las tres
 * matrices para el mismo rol Sistema, y `dashboard.read_own` en las tres para
 * roles distintos. Sin esta pasada, el índice único de la tabla rechaza el seed
 * a media corrida.
 */
export function flattenPermissions(): Array<{ roleCode: string; module: string; action: string }> {
  const seen = new Set<string>()
  const rows: Array<{ roleCode: string; module: string; action: string }> = []

  for (const p of PERMISSIONS) {
    for (const roleCode of p.roles) {
      const key = `${roleCode}|${p.module}|${p.action}`

      if (!seen.has(key)) {
        seen.add(key)
        rows.push({ roleCode, module: p.module, action: p.action })
      }
    }
  }

  return rows
}
