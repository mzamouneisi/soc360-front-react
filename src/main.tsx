import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { SocProvider } from './soc/SocContext'
import { I18nProvider } from './i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SocProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </SocProvider>
    </AuthProvider>
  </StrictMode>,
)
