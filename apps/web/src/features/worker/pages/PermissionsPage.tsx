import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import {
  queryPermissionState,
  requestCameraPermission,
  requestLocationPermission,
  type DevicePermissionState,
} from '../lib/devicePermissions'

import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import { Button } from '@/shared/components/Button'

interface PermissionRowConfig {
  key: 'camera' | 'geolocation'
  icon: string
  title: string
  why: string
  request: () => Promise<DevicePermissionState>
}

/**
 * Una fila por permiso: lo que ya sabe el navegador (sin pedir nada) y un
 * botón para pedirlo. Una vez que la persona lo BLOQUEÓ, el navegador ya no
 * vuelve a mostrar su diálogo — «Reintentar» solo sirve si lo cambió desde
 * los Ajustes del teléfono, así que el texto lo dice en vez de dejar que el
 * botón parezca no hacer nada.
 */
function PermissionRow({ config }: { config: PermissionRowConfig }): ReactNode {
  const { t } = useLingui()
  const [state, setState] = useState<DevicePermissionState>('prompt')
  const [isChecking, setChecking] = useState(true)
  const [isRequesting, setRequesting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void queryPermissionState(config.key).then((result) => {
      if (!cancelled) {
        setState(result)
        setChecking(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [config.key])

  async function request(): Promise<void> {
    setRequesting(true)
    const result = await config.request()
    setState(result)
    setRequesting(false)
    // Denegado se ve IGUAL antes y después: sin este aviso, comprobar de
    // nuevo y que siga bloqueado parece que el botón no hizo nada.
    if (result === 'denied') {
      toast.error(t`Sigue bloqueado. Actívalo desde los Ajustes de tu teléfono.`)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-o-500/15 text-o-700">
          <MaterialIcon name={config.icon} className="text-xl" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">{config.title}</p>
          <p className="mt-0.5 text-xs text-ink-3">{config.why}</p>
        </div>
        {!isChecking && state === 'granted' && (
          <span className="flex items-center gap-1 text-xs font-semibold text-green">
            <MaterialIcon name="check_circle" className="text-base" aria-hidden />
            <Trans>Activo</Trans>
          </span>
        )}
      </div>

      {!isChecking && state === 'denied' && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-xs leading-relaxed text-ink-2">
          <Trans>
            Lo bloqueaste antes: el navegador ya no vuelve a preguntar. Actívalo desde los Ajustes
            de tu teléfono, en los permisos de este sitio, y vuelve aquí a confirmar.
          </Trans>
        </p>
      )}

      {!isChecking && state !== 'granted' && (
        <Button
          variant="primary"
          disabled={isRequesting}
          onClick={() => {
            void request()
          }}
        >
          {isRequesting
            ? t`Comprobando…`
            : state === 'denied'
              ? t`Ya lo cambié: comprobar de nuevo`
              : t`Dar acceso`}
        </Button>
      )}
    </div>
  )
}

/**
 * Permisos, desde el menú de la cuenta: para cuando la persona negó cámara o
 * ubicación en el onboarding de Ponchar (o en el diálogo nativo del
 * teléfono) y quiere volver a intentarlo sin tener que ponchar a ciegas.
 */
export function PermissionsPage(): ReactNode {
  const { t } = useLingui()
  const rows: PermissionRowConfig[] = [
    {
      key: 'camera',
      icon: 'photo_camera',
      title: t`Cámara`,
      why: t`Para la foto de Entrada y Salida — cuando el hotel usa selfie y no QR.`,
      request: requestCameraPermission,
    },
    {
      key: 'geolocation',
      icon: 'location_on',
      title: t`Ubicación`,
      why: t`Para confirmar que estás dentro del hotel al ponchar.`,
      request: requestLocationPermission,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col items-center gap-3 text-center">
        <img src={personajeConfiguracion} alt="" aria-hidden className="h-28 w-auto" />
        <div>
          <h1 className="text-xl font-bold text-ink">
            <Trans>Permisos</Trans>
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            <Trans>Lo que tu teléfono le permite a Oranje para que puedas ponchar.</Trans>
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <PermissionRow key={row.key} config={row} />
        ))}
      </div>
    </div>
  )
}
