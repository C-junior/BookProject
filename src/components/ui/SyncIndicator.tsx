import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { useSyncStore } from '@/stores/syncStore'
import { syncAll } from '@/services/sync/syncService'
import { useEffect, useRef, useState } from 'react'
import './SyncIndicator.css'

export function SyncIndicator() {
    const { isSyncing, isOnline, lastSyncTime, lastSyncDevice, syncErrors, pendingChanges } = useSyncStore()
    const [showErrorDetails, setShowErrorDetails] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const latestError = syncErrors.length > 0 ? syncErrors[syncErrors.length - 1] : null

    const handleManualSync = async () => {
        await syncAll()
        setShowErrorDetails(false)
    }

    const handleClick = async () => {
        if (latestError) {
            setShowErrorDetails((prev) => !prev)
            return
        }
        await handleManualSync()
    }

    const getStatusIcon = () => {
        if (!isOnline) {
            return <CloudOff className="sync-icon offline" size={18} />
        }

        if (isSyncing) {
            return <RefreshCw className="sync-icon syncing" size={18} />
        }

        if (syncErrors.length > 0) {
            return <AlertCircle className="sync-icon error" size={18} />
        }

        if (pendingChanges > 0) {
            return (
                <div className="sync-pending">
                    <Cloud className="sync-icon pending" size={18} />
                    <span className="pending-badge">{pendingChanges}</span>
                </div>
            )
        }

        return <Check className="sync-icon synced" size={18} />
    }

    const getTooltip = () => {
        if (!isOnline) return 'Offline - Changes will sync when online'
        if (isSyncing) return 'Syncing...'
        if (latestError) return `Sync error: ${latestError}`
        if (pendingChanges > 0) return `${pendingChanges} changes pending`
        if (lastSyncTime) {
            const timeStr = formatTime(lastSyncTime)
            return lastSyncDevice
                ? `Last synced: ${timeStr} from ${lastSyncDevice}`
                : `Last synced: ${timeStr}`
        }
        return 'Synced'
    }

    const formatTime = (date: Date) => {
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)

        if (minutes < 1) return 'Just now'
        if (minutes < 60) return `${minutes}m ago`

        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`

        return date.toLocaleDateString()
    }

    useEffect(() => {
        if (!showErrorDetails) return

        const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setShowErrorDetails(false)
            }
        }

        document.addEventListener('mousedown', handleOutsideClick)
        document.addEventListener('touchstart', handleOutsideClick)
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick)
            document.removeEventListener('touchstart', handleOutsideClick)
        }
    }, [showErrorDetails])

    useEffect(() => {
        if (!latestError) {
            setShowErrorDetails(false)
        }
    }, [latestError])

    return (
        <div className="sync-indicator-container" ref={containerRef}>
            <button
                className={`sync-indicator ${isOnline ? 'online' : 'offline'}`}
                onClick={handleClick}
                disabled={isSyncing || !isOnline}
                title={getTooltip()}
            >
                {getStatusIcon()}
            </button>

            {showErrorDetails && latestError && (
                <div className="sync-error-popover" role="status">
                    <p className="sync-error-title">Sync error</p>
                    <p className="sync-error-message">{latestError}</p>
                    <button
                        className="sync-error-retry"
                        onClick={handleManualSync}
                        disabled={isSyncing || !isOnline}
                    >
                        Retry
                    </button>
                </div>
            )}
        </div>
    )
}
