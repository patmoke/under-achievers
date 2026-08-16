import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import CrashScreen from './components/CrashScreen.jsx'
import { initMonitoring } from './lib/monitoring'

// Before render, so a crash during the very first paint is still reported.
initMonitoring()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={CrashScreen}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
