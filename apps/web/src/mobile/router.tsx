import { type ReactElement } from 'react'
import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router'

import { RequireSession } from '@/app/RequireSession'

/**
 * El router de la app EMPAQUETADA del Colaborador (Android / iOS con Capacitor).
 *
 * Es el mismo árbol de `app/router.tsx` recortado a `/collaborator/*`: aquí no
 * existe el staff, así que no hay `AppShell`, ni sidebar, ni las 25 rutas de
 * los módulos. Eso es justo lo que se busca — el bundle de la app no carga
 * three.js, recharts ni el editor de propuestas, que el Colaborador nunca abre.
 *
 * NO se importa el `router` del web: aquel monta `AppShell` y arrastraría todo
 * el staff al bundle por más que las rutas fueran inalcanzables.
 */

/**
 * Las rutas viejas en español siguen vivas por la misma razón que en el web
 * (ver `app/router.tsx`): hay **códigos QR impresos y pegados en la puerta de
 * un hotel** que apuntan a `/colaborador/ponchar?qr=…`. Cuando esos enlaces
 * entren a la app como deep link, tienen que caer en la pantalla correcta y
 * **con su `?qr=`** — perderlo deja al colaborador frente al lector sin código.
 */
const LEGACY_PATHS: Array<{ from: string; to: string }> = [
  { from: 'colaborador', to: '/collaborator' },
  { from: 'colaborador/perfil', to: '/collaborator/profile' },
  { from: 'colaborador/ponchar', to: '/collaborator/punch' },
  { from: 'colaborador/avisos', to: '/collaborator/notifications' },
  { from: 'colaborador/alta-2', to: '/collaborator/signup-2' },
  { from: 'colaborador/alta-3', to: '/collaborator/signup-3' },
]

/** Manda a la ruta nueva conservando los parámetros y la cadena de consulta. */
function LegacyRedirect({ to }: { to: string }): ReactElement {
  const params = useParams()
  const { search, hash } = useLocation()
  const target = to.replace(/:([A-Za-z]+)/g, (_match, name: string) => params[name] ?? '')

  return <Navigate to={`${target}${search}${hash}`} replace />
}

/**
 * La puerta, con los textos del Colaborador (ROL-C-01). Se monta en DOS rutas
 * a propósito — ver el comentario de `/login` abajo.
 */
const loginRoute = {
  lazy: async () => {
    const m = await import('@/features/auth')
    return { Component: m.ColaboradorLoginPage }
  },
}

export const mobileRouter = createBrowserRouter([
  /*
   * `/` va FUERA de `RequireSession`, y esto no es cosmético: el guard decide
   * a qué login mandar mirando el pathname —`startsWith('/collaborator')`, ver
   * `app/RequireSession.tsx`— y la app arranca en `/`, que no empieza con eso.
   * Con la redirección DENTRO del guard, el guard corría primero, concluía
   * «esto no es del Colaborador» y mandaba a `/login`: la pantalla en blanco.
   * Aquí `/` se resuelve antes de que ningún guard opine.
   *
   * Sirve además para el regreso del login, que navega a `from ?? '/'`.
   */
  { path: '/', element: <Navigate to="/collaborator" replace /> },

  { path: '/collaborator/login', ...loginRoute },

  /*
   * `/login` también, aunque en esta app no exista el staff: es a donde manda
   * `RequireSession` cuando el pathname no le parece del Colaborador, y ese
   * archivo es compartido con la web — no se toca desde aquí. Mapearlo a la
   * misma puerta convierte ese caso en algo inofensivo en vez de una ruta
   * muerta. Red de seguridad, no la corrección: la corrección es la de arriba.
   */
  { path: '/login', ...loginRoute },

  {
    /* Sin `path`: es una ruta de layout. Sus hijos cuelgan de la raíz igual
       que antes, pero `/` ya no cae aquí dentro. */
    Component: RequireSession,
    children: [
      ...LEGACY_PATHS.map(({ from, to }) => ({
        path: from,
        element: <LegacyRedirect to={to} />,
      })),
      {
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
    ],
  },

  /*
   * Cualquier otra ruta del web (las 25 del staff) no existe aquí: a Inicio.
   * Va FUERA del guard por lo mismo que `/`: dentro, `RequireSession` resuelve
   * a login antes de llegar al `Outlet` y el comodín nunca se rendería.
   * Último de la lista: React Router prefiere lo específico, pero el orden lo
   * deja explícito para quien lea.
   */
  { path: '*', element: <Navigate to="/collaborator" replace /> },
])
