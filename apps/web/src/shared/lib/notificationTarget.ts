/**
 * A dónde lleva un aviso al tocarlo.
 *
 * El API guarda con cada notificación la entidad que la provocó
 * (`entity: { type, id }`) y la venía mandando sin que nadie la usara: la
 * campana solo marcaba leído y dejaba a la persona buscando la pantalla a
 * mano (Hugo, 2026-09-30).
 *
 * El mapa es deliberadamente corto: solo las entidades que hoy disparan
 * avisos de verdad. Una entidad sin ruta conocida devuelve `null` y el aviso
 * se queda como estaba —se marca leído y nada más—, que es mejor que
 * inventar un destino y aterrizar en un 404.
 */
export interface NotificationEntityRef {
  type: string
  id: string
}

/** Qué ruta abre cada entidad. Vive aquí y no en el API: las rutas son del front. */
const ROUTE_BY_ENTITY: Record<string, (id: string) => string> = {
  'personal.worker': (id) => `/collaborator-pool/${id}`,
  'demand.requisition': (id) => `/requisitions/${id}`,
  'commercial.prospect': (id) => `/pipeline/${id}`,
  'commercial.contract': (id) => `/contracts/${id}`,
  /* El ponche y el timesheet no tienen pantalla propia por id: la revisión
     ocurre en el Timesheet, que es donde hay que aterrizar. */
  'operations.punch_mark': () => '/timesheet',
  'operations.timesheet': () => '/timesheet',
  'operations.timesheet_day': () => '/timesheet',
  /* Una asignación se resuelve mirando a su colaborador, que es lo que la
     persona quiere ver; sin pantalla de asignación suelta. */
  'coverage.assignment': () => '/my-staff',
  /* `/dashboard` y no `/users`: una cuenta de personal no tiene pantalla
     propia por id, y «Usuarios» es solo del Administrador — un BDC con un
     aviso de cuenta por aprobar aterrizaba ahí y no veía nada (Hugo,
     2026-10-02). `/dashboard` ya redirige al Administrador A `/users`, así
     que para él el destino no cambia; para el resto cae en SU dashboard, que
     es donde ahora vive lo que tenga pendiente. */
  'identity.user': () => '/dashboard',
}

export function notificationTarget(entity: NotificationEntityRef | null): string | null {
  if (!entity) return null

  return ROUTE_BY_ENTITY[entity.type]?.(entity.id) ?? null
}
