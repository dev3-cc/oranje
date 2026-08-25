import { useGetSessionQuery } from '@/app/sessionApi'

export function useCan(): (permission: string) => boolean {
  const { data: session } = useGetSessionQuery()
  const permissions = session?.permissions ?? []
  return (permission: string) => permissions.length === 0 || permissions.includes(permission)
}
