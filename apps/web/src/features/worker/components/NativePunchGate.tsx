import { useLingui } from '@lingui/react/macro'
import { useEffect, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router'

import {
  checkNativePermissions,
  hasNativePermissions,
  onNativePermissionsChange,
  type NativePermissions,
} from '../lib/nativePermissions'
import { usePermissionsScreen } from '../lib/usePermissionsScreen'

import { WorkerSkeleton } from './WorkerSkeleton'

import personajeAccesoProtegido from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import { Button } from '@/shared/components/Button'
import { NoticeCard } from '@/shared/components/NoticeCard'

/**
 * El candado de Ponchar en la app: sin ubicación precisa, GPS y cámara no se
 * entra. Es la misma regla que el botón «Ponchar» de la pantalla nativa, pero
 * aquí cubre los otros caminos —la pestaña, el deslizamiento, un enlace—.
 * Si el permiso se quita con la pantalla abierta, el candado vuelve a cerrar:
 * el nativo avisa al volver al frente.
 *
 * Solo lo monta el router de la app (`mobile/router.tsx`). En el navegador no
 * hay nada que revisar y deja pasar tal cual.
 */
export function NativePunchGate(): ReactNode {
  const { t } = useLingui()
  const openPermissions = usePermissionsScreen()
  const isNative = hasNativePermissions()
  const [permissions, setPermissions] = useState<NativePermissions | null>(null)

  useEffect(() => {
    if (!isNative) return
    void checkNativePermissions().then(setPermissions)
    return onNativePermissionsChange(setPermissions)
  }, [isNative])

  if (!isNative) return <Outlet />
  if (permissions === null) return <WorkerSkeleton variant="punch" />
  if (permissions.ready) return <Outlet />

  return (
    <NoticeCard
      role="alert"
      tone="warning"
      image={personajeAccesoProtegido}
      title={t`Faltan permisos para ponchar`}
      action={
        <Button
          variant="primary"
          onClick={() => {
            void openPermissions()
          }}
        >
          {t`Revisar permisos`}
        </Button>
      }
    >
      {t`Para ponchar, la app necesita tu ubicación precisa, el GPS encendido y la cámara. Revisa qué falta y actívalo.`}
    </NoticeCard>
  )
}
