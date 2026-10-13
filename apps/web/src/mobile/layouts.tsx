import { Trans } from '@lingui/react/macro'
import { MaterialIcon, Toaster } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router'

import { homePathFor, isHotelRole } from './roles'

import { useAppSelector } from '@/app/hooks'
import { selectSessionUser } from '@/app/sessionSlice'

/**
 * La puerta del apartado del hotel: Supervisor, Manager de Área y Manager
 * General ven el shell del web tal cual; cualquier otro rol vuelve a su
 * apartado (el resto del staff trabaja en el web, no en la app).
 */
export function HotelOnly(): ReactNode {
  const user = useAppSelector(selectSessionUser)
  if (!user) return null
  if (!isHotelRole(user.roleId)) return <Navigate to={homePathFor(user.roleId)} replace />
  return <Outlet />
}

/**
 * Los avisos (`toast`) de lo que NO monta el `AppShell` del web: el login, el
 * Colaborador y la pantalla de rol sin app. El shell del hotel trae su propio
 * `Toaster`; montarlo dos veces duplicaba cada aviso.
 */
export function WithToaster(): ReactNode {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  )
}

/**
 * Las hojas del web que viven FUERA del shell (la del QR de ponche) con una
 * barra para volver. En el navegador se abren en otra pestaña y se cierran;
 * en la app se abren en la misma pantalla, y en iOS no hay botón de Atrás.
 * Lleva su `Toaster`: la hoja no monta uno y sus avisos no se veían.
 */
export function WithBackBar(): ReactNode {
  const navigate = useNavigate()

  const goBack = (): void => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (historyIndex > 0) void navigate(-1)
    else void navigate('/', { replace: true })
  }

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-line bg-white px-2 py-1">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-o-500"
        >
          <MaterialIcon name="arrow_back" className="text-lg" aria-hidden />
          <Trans>Volver</Trans>
        </button>
      </div>
      <Outlet />
      <Toaster />
    </>
  )
}
