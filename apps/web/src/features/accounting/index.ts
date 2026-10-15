/* Única superficie pública de Contabilidad (§4). */
export { ConsolidationsPage } from './pages/ConsolidationsPage'
export { ConsolidationDetailPage } from './pages/ConsolidationDetailPage'
export { InvoicesPage } from './pages/InvoicesPage'
export { InvoiceDetailPage } from './pages/InvoiceDetailPage'
export { AccountingTimesheetPage } from './pages/AccountingTimesheetPage'
export { PendingApprovalsPage } from './pages/PendingApprovalsPage'
export { PrePayrollPage, DeductionsPage, VacationsPage } from './pages/AccountingPendingPages'
export { PayAdjustmentsInclusionPage } from './pages/PayAdjustmentsInclusionPage'
/* El estado del Consolidado + «Pagar» vive dentro del panel de detalle del
   Timesheet del staff (Hugo, 2026-10-13: misma lista deslizante y mismo
   panel de detalle que ya usa Mi Personal), así que se expone aquí para que
   esa feature lo importe por el índice. */
export { ConsolidationPayStatus } from './components/ConsolidationPayStatus'
/* Corregir tarifa/reparto de horas es de Contabilidad, no del hotel — el
   Timesheet del staff reusa el mismo diálogo que ya usa Timesheet Global,
   en vez de construir un formulario propio del mismo ajuste (Hugo,
   2026-10-15). */
export { PayOverrideDialog, type PayOverrideTarget } from './components/PayOverrideDialog'
