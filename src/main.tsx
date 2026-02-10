import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)

// Register service worker with user-prompted update
const updateSW = registerSW({
    onNeedRefresh() {
        // Show a non-blocking confirmation when a new version is available
        if (confirm('New version available! Reload to update?')) {
            updateSW(true)
        }
    },
    onOfflineReady() {
        console.log('Codex is ready for offline use')
    }
})
