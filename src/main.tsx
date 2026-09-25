import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bricolage-grotesque/latin-600.css'
import '@fontsource/bricolage-grotesque/latin-800.css'
import '@fontsource/figtree/latin-400.css'
import '@fontsource/figtree/latin-500.css'
import '@fontsource/figtree/latin-600.css'
import '@fontsource/figtree/latin-700.css'
import './styles/tokens.css'
import './styles/global.css'
import './styles/months.css'
import { App } from './app/App'

const root = document.getElementById('root')
if (!root) throw new Error('Não foi possível encontrar a raiz do app.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
