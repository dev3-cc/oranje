import { useGetSessionQuery } from '@/app/sessionApi'

export function useCan(): (permission: string) => boolean {
  const { data: session } = useGetSessionQuery()
  const permissions = session?.permissions ?? []
  /*
   * `GET /me` entrega el par como `module.action` (punto); las pantallas lo
   * piden como `modulo:accion`. Se normaliza aquí para que un permiso real
   * jamás falle por el separador. Lista vacía = resguardo: se muestra todo.
   */
  return (permission: string) =>
    permissions.length === 0 || permissions.includes(permission.replace(':', '.'))
}
