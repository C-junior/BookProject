import { useEffect, useRef } from 'react'

/**
 * Acquires a screen Wake Lock while the component is mounted.
 * Prevents the screen from dimming/locking during reading.
 * Re-acquires on visibility change (required by spec).
 * Graceful no-op on unsupported browsers.
 */
export function useWakeLock() {
    const wakeLockRef = useRef<WakeLockSentinel | null>(null)

    useEffect(() => {
        if (!('wakeLock' in navigator)) return

        const acquire = async () => {
            try {
                wakeLockRef.current = await navigator.wakeLock.request('screen')
            } catch {
                // Permission denied or not supported — silent fallback
            }
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                acquire()
            }
        }

        acquire()
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            wakeLockRef.current?.release()
            wakeLockRef.current = null
        }
    }, [])
}
