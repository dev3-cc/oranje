import { msg } from '@lingui/core/macro'

import { homePathFor, isHotelRole, isWorkerRole } from './roles'

import { baseApi } from '@/app/baseApi'
import { i18n } from '@/app/i18n'
import { selectSessionUser } from '@/app/sessionSlice'
import type { store as appStore } from '@/app/store'

/**
 * Los avisos PUSH de la app, por Firebase Cloud Messaging
 * (`@capacitor-firebase/messaging`, instalado en `apps/mobile`).
 *
 * El API ya manda cada aviso por FCM a los dispositivos registrados del usuario
 * (`notifications/push.service.ts`); lo que faltaba es que la app registrara su
 * token. Aquí:
 *
 *   - Al haber sesión, el token va a `POST /devices` (alta o renovación: el API
 *     se lo quita a quien lo tuviera antes en ese teléfono). Si FCM lo rota, se
 *     vuelve a registrar.
 *   - Al cerrar sesión se BORRA el token del teléfono: el API lo revoca solo la
 *     próxima vez que FCM lo rechace, y el teléfono deja de recibir los avisos
 *     de quien salió. No hace falta sesión para eso.
 *   - Tocar un aviso del sistema abre su pantalla (ver `pushRouteFor`). Si la
 *     app estaba cerrada, el plugin guarda el toque hasta que se escucha.
 *   - Con la app abierta FCM no dibuja el aviso: se refresca la campana.
 *
 * Igual que los demás puentes: no se importa `@capacitor/*`, se habla con el
 * `window.Capacitor` del WebView. En el navegador no hace nada.
 */

const PLUGIN = 'FirebaseMessaging'

/** El canal de Android; el mismo id va en `AndroidManifest.xml`. */
const CHANNEL_ID = 'avisos'

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  isPluginAvailable?: (name: string) => boolean
  nativePromise: <T>(plugin: string, method: string, options?: object) => Promise<T>
  addListener?: (plugin: string, event: string, callback: (data: unknown) => void) => unknown
}

/** Lo que el API manda en `data` (`push.service.ts`): todo como cadenas. */
export interface PushData {
  type?: string
  entityType?: string
  entityId?: string
}

/** A dónde lleva un aviso según quién lo recibe y de qué trata. */
export function pushRouteFor(roleId: string | undefined, data: PushData): string {
  if (isWorkerRole(roleId)) return '/collaborator/notifications'
  if (!isHotelRole(roleId)) return homePathFor(roleId)

  switch (data.entityType) {
    case 'demand.requisition':
      return data.entityId ? `/requisitions/${data.entityId}` : '/requisitions'
    case 'operations.timesheet':
    case 'operations.punch_mark':
      return '/timesheet'
    case 'personal.worker':
    case 'coverage.assignment':
      return '/my-staff'
    default:
      return homePathFor(roleId)
  }
}

/** Los datos del aviso tocado, vengan como vengan del plugin. */
function dataOf(event: unknown): PushData {
  const data = (event as { notification?: { data?: unknown } } | null)?.notification?.data
  return typeof data === 'object' && data !== null ? data : {}
}

const pushApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    registerPushDevice: build.mutation<
      { data: { id: string; platform: string } },
      { fcmToken: string; platform: 'ANDROID' | 'IOS' }
    >({
      query: (body) => ({ url: '/devices', method: 'POST', body }),
    }),
  }),
})

export function installNativePush(store: typeof appStore, navigate: (path: string) => void): void {
  const cap = (window as { Capacitor?: CapacitorBridge }).Capacitor
  if (!cap?.isNativePlatform?.() || !cap.isPluginAvailable?.(PLUGIN) || !cap.addListener) return
  const listen = cap.addListener
  const platform = cap.getPlatform?.() === 'ios' ? 'IOS' : 'ANDROID'

  if (platform === 'ANDROID') {
    void cap
      .nativePromise(PLUGIN, 'createChannel', {
        id: CHANNEL_ID,
        name: i18n._(msg`Avisos`),
        importance: 4,
      })
      .catch(() => undefined)
  }

  let userId: string | null = null
  /** Un aviso tocado antes de que la sesión cargara: se abre al llegar. */
  let pendingTap: PushData | null = null
  /**
   * `usuario|token` ya registrado (o en curso). Al arrancar llegan casi juntos
   * el registro por la sesión y el `tokenReceived` del plugin con el MISMO
   * token: sin esto salían dos `POST /devices` a la vez y uno chocaba (500).
   */
  let registered: string | null = null

  const register = async (token?: string): Promise<void> => {
    let key: string | null = null
    try {
      const fcmToken =
        token ?? (await cap.nativePromise<{ token: string }>(PLUGIN, 'getToken')).token
      if (!fcmToken || userId === null) return
      key = `${userId}|${fcmToken}`
      if (registered === key) return
      registered = key
      await store
        .dispatch(pushApi.endpoints.registerPushDevice.initiate({ fcmToken, platform }))
        .unwrap()
    } catch {
      /* Sin token (sin Google Play, sin red): la app sigue igual, con la campana.
         Si falló el registro, se reintenta en el próximo arranque o rotación. */
      if (key !== null && registered === key) registered = null
    }
  }

  const openTap = (data: PushData): void => {
    navigate(pushRouteFor(selectSessionUser(store.getState())?.roleId, data))
  }

  store.subscribe(() => {
    const next = selectSessionUser(store.getState())?.id ?? null
    if (next === userId) return
    const previous = userId
    userId = next
    if (next !== null) {
      void register()
      if (pendingTap) {
        openTap(pendingTap)
        pendingTap = null
      }
    } else if (previous !== null) {
      registered = null
      void cap.nativePromise(PLUGIN, 'deleteToken').catch(() => undefined)
    }
  })

  listen.call(cap, PLUGIN, 'tokenReceived', (event) => {
    const token = (event as { token?: unknown } | null)?.token
    if (typeof token === 'string') void register(token)
  })

  listen.call(cap, PLUGIN, 'notificationActionPerformed', (event) => {
    const data = dataOf(event)
    if (userId === null) pendingTap = data
    else openTap(data)
  })

  listen.call(cap, PLUGIN, 'notificationReceived', () => {
    store.dispatch(baseApi.util.invalidateTags([{ type: 'Worker', id: 'NOTIFICATIONS' }]))
  })
}
