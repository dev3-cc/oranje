import '@fontsource-variable/montserrat'
import 'material-icons/iconfont/round.css'
import 'material-icons/iconfont/outlined.css'
import './styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from './app/providers'

const container = document.getElementById('root')
if (!container) throw new Error('Falta #root en index.html')

createRoot(container).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
)
