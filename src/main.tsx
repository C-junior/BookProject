import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './i18n' // Import i18n setup
import App from './App'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)

// Register service worker with user-prompted update via custom toast
const updateSW = registerSW({
    onNeedRefresh() {
        // Dispatch custom event — App.tsx listens for it and shows a non-blocking toast
        window.dispatchEvent(new CustomEvent('sw-update-available'))
    },
    onOfflineReady() {
        console.log('Codex is ready for offline use')
    }
})

    // Expose updateSW globally so the toast component can trigger it
    ; (window as any).__codex_updateSW = () => updateSW(true)
