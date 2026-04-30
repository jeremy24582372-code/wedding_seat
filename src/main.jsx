import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.jsx'
import PasswordGate from './components/PasswordGate.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <PasswordGate>
        <App />
      </PasswordGate>
    </ErrorBoundary>
  </StrictMode>,
)
