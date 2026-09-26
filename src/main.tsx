import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { ToastProvider } from './components/Toasts'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
