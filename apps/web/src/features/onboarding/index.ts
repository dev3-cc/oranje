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
