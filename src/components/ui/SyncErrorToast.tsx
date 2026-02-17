import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useSyncStore } from '@/stores/syncStore'
import { syncAll } from '@/services/sync/syncService'
import './SyncErrorToast.css'

export function SyncErrorToast() {
    const { syncErrors, clearSyncErrors, isOnline, isSyncing } = useSyncStore()
    const latestError = useMemo(() => syncErrors[syncErrors.length - 1] || null, [syncErrors])
    const [visibleError, setVisibleError] = useState<string | null>(null)
    const [dismissing, setDismissing] = useState(false)

    useEffect(() => {
        if (!latestError) {
            setVisibleError(null)
            setDismissing(false)
            return
        }
        setVisibleError(latestError)
        setDismissing(false)
    }, [latestError])

    const handleDismiss = useCallback(() => {
        setDismissing(true)
        window.setTimeout(() => {
            clearSyncErrors()
            setVisibleError(null)
            setDismissing(false)
        }, 200)
    }, [clearSyncErrors])

    const handleRetry = useCallback(async () => {
        await syncAll()
    }, [])

    if (!visibleError) return null

    return (
        <div className={`sync-error-toast ${dismissing ? 'sync-error-toast--dismissing' : ''}`} role="alert">
            <div className="sync-error-toast__content">
                <AlertCircle size={18} className="sync-error-toast__icon" />
                <div className="sync-error-toast__text">
                    <strong>Sync failed</strong>
                    <span>{visibleError}</span>
                </div>
            </div>
            <div className="sync-error-toast__actions">
                <button className="sync-error-toast__btn sync-error-toast__btn--dismiss" onClick={handleDismiss}>
                    Dismiss
                </button>
                <button
                    className="sync-error-toast__btn sync-error-toast__btn--retry"
                    onClick={handleRetry}
                    disabled={!isOnline || isSyncing}
                >
                    Retry
                </button>
            </div>
        </div>
    )
}

export default SyncErrorToast
