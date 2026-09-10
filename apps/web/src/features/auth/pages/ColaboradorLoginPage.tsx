import type { ReactNode } from 'react'

import { LoginPage } from './LoginPage'

/** `/colaborador/login`: la misma puerta, con los textos del Colaborador. */
export function ColaboradorLoginPage(): ReactNode {
  return <LoginPage audience="colaborador" />
}
