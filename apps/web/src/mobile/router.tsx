import { type ReactElement } from 'react'
import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router'

import { MobileRoleHome } from './MobileRoleHome'
import { PermissionsOnLaunch } from './PermissionsOnLaunch'
import { HOTEL_HOME, UNSUPPORTED_HOME } from './roles'

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
 * LA puerta de la app: una sola para el Colaborador y para el hotel
 * (`AppLoginPage`). Se monta en las dos rutas a las que manda `RequireSession`
 * —`/collaborator/login` para lo del Colaborador, `/login` para todo lo
 * demás—: ese archivo es compartido con la web y no se toca desde aquí.
 */
const loginRoute = {
  lazy: async () => {
    const m = await import('./AppLoginPage')
    return { Component: m.AppLoginPage }
  },
}

export const mobileRouter = createBrowserRouter([
  {
    /*
     * La raíz de TODO el árbol: abre la pantalla nativa de Permisos al quedar
     * con sesión (ver `PermissionsOnLaunch`). Ruta de layout sin `path`: sus
     * hijos resuelven exactamente igual que si colgaran de la raíz.
     */
    Component: PermissionsOnLaunch,
    children: [
      { path: '/collaborator/login', ...loginRoute },
      { path: '/login', ...loginRoute },

      {
        /* Sin `path`: es una ruta de layout. Sus hijos cuelgan de la raíz igual
       que antes, pero `/` ya no cae aquí dentro. */
        Component: RequireSession,
        children: [
          /*
           * `/` reparte por rol: el Colaborador a `/collaborator`, el hotel a
           * `/hotel`, el resto del staff a la pantalla que le dice que su
           * trabajo está en el web. Dentro del guard: sin sesión, el guard
           * manda a `/login` (la puerta única) y el login regresa a `/`.
           */
          { index: true, Component: MobileRoleHome },
          {
            path: UNSUPPORTED_HOME.slice(1),
            lazy: async () => {
              const m = await import('./UnsupportedRolePage')
              return { Component: m.UnsupportedRolePage }
            },
          },
          {
            /* El apartado del hotel: Supervisor, Manager de Área y Manager General. */
            path: HOTEL_HOME.slice(1),
            lazy: async () => {
              const m = await import('./hotel/HotelShell')
              return { Component: m.HotelShell }
            },
            children: [
              {
                index: true,
                lazy: async () => {
                  const m = await import('./hotel/HotelHomePage')
                  return { Component: m.HotelHomePage }
                },
              },
            ],
          },
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
                /*
                 * El candado de Ponchar: sin ubicación precisa, GPS y cámara la
                 * app no deja entrar (la misma regla que el botón de la pantalla
                 * nativa de Permisos). Solo existe en este router; el web no lo monta.
                 */
                lazy: async () => {
                  const m = await import('@/features/worker')
                  return { Component: m.NativePunchGate }
                },
                children: [
                  {
                    path: 'punch',
                    lazy: async () => {
                      const m = await import('@/features/worker')
                      return { Component: m.PunchPage }
                    },
                  },
                ],
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
       * Cualquier otra ruta del web (las del staff) no existe aquí: a `/`, que
       * reparte por rol. Último de la lista: React Router prefiere lo
       * específico, pero el orden lo deja explícito para quien lea.
       */
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
