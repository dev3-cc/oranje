/** Única superficie pública de la feature (§4). */
export { TimesheetPage } from './pages/TimesheetPage'
export { TimesheetGlobalPage } from './pages/TimesheetGlobalPage'

/**
 * Piezas genéricas de navegación semanal, reutilizadas por Schedule (mismo
 * carrusel paginado, mismas semanas "que existen en los datos"): se exponen
 * aquí — y no por su ruta interna — porque §4 exige que una feature se
 * importe SOLO por su índice.
 */
export { WeekSlider, WeekDragContext } from './components/WeekSlider'
export { WeekNavigator } from './components/TimesheetViewControls'
export {
  addDaysIso,
  neighborWeek,
  resolveWeek,
  todayIso,
  weekContaining,
} from './lib/weekNavigation'
