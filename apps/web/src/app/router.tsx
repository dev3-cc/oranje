import { createBrowserRouter } from 'react-router'

import { RequireSession } from './RequireSession'
import { LEGACY_WORKER_ROUTES, punchQrPrintRoute, staffShellRoute } from './staffRoutes'

/**
 * React Router 8 en *data mode* (D-17).
 *
 * NO se usa framework mode: trae SSR y rutas por archivo, y D-04 dice que esta
 * app es un artefacto estático detrás del Load Balancer, sin servidor que la
 * renderice.
 *
 * Cada ruta de primer nivel corresponde a un módulo del sidebar del rol
 * (ver `Estructura General App`). Las del staff viven en `staffRoutes.tsx`.
 */
export const router = createBrowserRouter([
  {
    /** Ruta pública. Lazy: three.js no viaja en el bundle inicial. */
    path: '/login',
    lazy: async () => {
      const m = await import('@/features/auth')
      return { Component: m.LoginPage }
    },
  },
  {
    /** La misma puerta con los textos del Colaborador (ROL-C-01). */
    path: '/collaborator/login',
    lazy: async () => {
      const m = await import('@/features/auth')
      return { Component: m.ColaboradorLoginPage }
    },
  },
  {
    path: '/',
    /** Sin sesión no hay shell: el guard intenta el refresh y decide. */
    Component: RequireSession,
    children: [
      punchQrPrintRoute,
      ...LEGACY_WORKER_ROUTES,
      {
        /**
         * El apartado del Colaborador (ROL-C-01): web responsive que imita la
         * app móvil de la maqueta. Vive FUERA del AppShell — el Colaborador no
         * usa el sidebar del staff.
         */
        path: 'collaborator',
        lazy: async () => {
          const m = await import('@/features/worker')
          return { Component: m.MobileShell }
        },
        children: [
          {
            index: true,
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.HomePage }
            },
          },
          {
            path: 'profile',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.ProfilePage }
            },
          },
          {
            path: 'password',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.PasswordPage }
            },
          },
          {
            path: 'permissions',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.PermissionsPage }
            },
          },
          {
            path: 'punch',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.PunchPage }
            },
          },
          {
            path: 'signup-2',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.Phase2Page }
            },
          },
          {
            path: 'signup-3',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.Phase3Page }
            },
          },
          {
            path: 'notifications',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.NotificationsPage }
            },
          },
        ],
      },
      staffShellRoute,
    ],
  },
])
