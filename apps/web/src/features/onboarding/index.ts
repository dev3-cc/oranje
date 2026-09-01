/**
 * Única superficie pública de la feature (§4).
 *
 * Nada de fuera de `features/onboarding/` importa por dentro de esta carpeta:
 * el ESLint del proyecto lo bloquea. Si otra feature llega a necesitar un
 * componente de aquí, ese componente sube a `shared/components/`.
 */
export { PipelinePage } from './pages/PipelinePage'
export { ProspectDetailPage } from './pages/ProspectDetailPage'
export { ProposalEditorPage } from './pages/ProposalEditorPage'
export { ProposalListPage } from './pages/ProposalListPage'
export { ProposalVersionPage } from './pages/ProposalVersionPage'

/** La conversión reusa el catálogo de motivos del semáforo. */
export { useGetStatusChangeReasonsQuery } from './api/onboardingApi'

export { useGetHotelMapPointsQuery } from './api/onboardingApi'
export type { HotelMapPoint } from './types/prospect.types'
export { ProspectCard } from './components/ProspectCard'
export { adaptProspectSummary } from './api/adapters'
export type { ProspectSummary } from './types/prospect.types'
