/** Única superficie pública de la feature (§4). */
export { AuditsPage } from './pages/AuditsPage'

/**
 * El catálogo de reactivos (`catalogs.audit_checklist_item`) también se
 * administra desde `/catalogos` (Administrador): se exporta aquí porque esta
 * feature es su dueña de dominio, evitando duplicar el CRUD en `admin`.
 */
export {
  useGetChecklistItemsQuery,
  useCreateChecklistItemMutation,
  useUpdateChecklistItemMutation,
  useDeleteChecklistItemMutation,
} from './api/auditsApi'
export type { AdminChecklistItem, AuditType, ChecklistItem } from './types/audit.types'
export { AUDIT_TYPES } from './types/audit.types'
