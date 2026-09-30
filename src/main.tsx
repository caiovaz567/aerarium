import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The Hyperion language: Inter everywhere; the brand typeface only in the wordmark.
import '@fontsource/bricolage-grotesque/latin-800.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import './styles/tokens.css'
import './styles/global.css'
import './styles/months.css'
import './styles/cards.css'
import './styles/launch.css'
import './styles/edit.css'
import './styles/categories.css'
import './styles/settings.css'
import './styles/timeline.css'
import { App } from './app/App'
import { healStyles } from './app/healStyles'

// In the built app the stylesheet is a separate file (in development, the
// styles come with the code).
if (import.meta.env.PROD)
  window.addEventListener('load', () => void healStyles())

const root = document.getElementById('root')
if (!root) throw new Error('Não foi possível encontrar a raiz do app.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
