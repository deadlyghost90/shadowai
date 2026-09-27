import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/theme.css'
import './styles/app.css'
import './styles/auth.css'

const root = document.getElementById('root')
if (!root) throw new Error('ShadowAI could not find its mount point.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
