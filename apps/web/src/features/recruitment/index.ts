/** Única superficie pública de la feature (§4). */
export { PoolPage } from './pages/PoolPage'
export { WorkerDetailPage } from './pages/WorkerDetailPage'
export { BlacklistPage } from './pages/BlacklistPage'
export { SelfPickPage } from './pages/SelfPickPage'
export { SlotAssignmentPage } from './pages/SlotAssignmentPage'
export {
  useGetPendingPayAdjustmentsQuery,
  useApprovePayAdjustmentMutation,
  useRejectPayAdjustmentMutation,
  useGetApprovedPendingInclusionQuery,
  useIncludePayAdjustmentMutation,
} from './api/payAdjustmentsApi'
export { seedApprovedPendingInclusion } from './api/payAdjustmentsMocks'
export type { PayAdjustment, SettlementEffect } from './types/selfPick.types'
