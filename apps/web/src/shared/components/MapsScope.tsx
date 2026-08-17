import { APIProvider } from '@vis.gl/react-google-maps'
import type { ReactNode } from 'react'

import { isMapsEnabled, MAPS_API_KEY } from '@/shared/constants/googleMaps'

/**
 * Contexto de Google Maps para componentes que están en sitios distintos de la
 * pantalla.
 *
 * Existe porque el buscador de Places y el mapa viven en columnas opuestas del
 * modal de alta y ambos necesitan la API cargada. Con un `APIProvider` por
 * componente el script se inicializaría dos veces, con contextos separados.
 *
 * Sin key no monta el proveedor: cada hijo pinta su propio aviso.
 */
export function MapsScope({ children }: { children: ReactNode }): ReactNode {
  if (!isMapsEnabled) return <>{children}</>

  return <APIProvider apiKey={MAPS_API_KEY}>{children}</APIProvider>
}
