import { useEffect, useRef, type RefObject } from 'react'

interface SwipeOptions {
    /** Minimum horizontal distance (px) to trigger swipe. Default: 50 */
    threshold?: number
    /** Element ref to attach listeners to */
    ref: RefObject<HTMLElement | null>
    /** Called when user swipes left (next page) */
    onSwipeLeft: () => void
    /** Called when user swipes right (previous page) */
    onSwipeRight: () => void
    /** Disable swipe detection */
    disabled?: boolean
}

/**
 * Hook for detecting horizontal swipe gestures on touch devices.
 * Swipe left → onSwipeLeft (next page)
 * Swipe right → onSwipeRight (previous page)
 */
export function useSwipeNavigation({
    ref,
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    disabled = false
}: SwipeOptions): void {
    const touchStart = useRef<{ x: number; y: number } | null>(null)

    useEffect(() => {
        const element = ref.current
        if (!element || disabled) return

        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0]
            if (touch) {
                touchStart.current = { x: touch.clientX, y: touch.clientY }
            }
        }

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchStart.current) return

            const touch = e.changedTouches[0]
            if (!touch) {
                touchStart.current = null
                return
            }

            const deltaX = touchStart.current.x - touch.clientX
            const deltaY = Math.abs(touchStart.current.y - touch.clientY)

            // Only trigger if horizontal movement exceeds threshold
            // and is significantly more horizontal than vertical
            if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > deltaY * 0.7) {
                if (deltaX > 0) {
                    // Swiped left → go to next page
                    onSwipeLeft()
                } else {
                    // Swiped right → go to previous page
                    onSwipeRight()
                }
            }

            touchStart.current = null
        }

        const handleTouchCancel = () => {
            touchStart.current = null
        }

        element.addEventListener('touchstart', handleTouchStart, { passive: true })
        element.addEventListener('touchend', handleTouchEnd, { passive: true })
        element.addEventListener('touchcancel', handleTouchCancel, { passive: true })

        return () => {
            element.removeEventListener('touchstart', handleTouchStart)
            element.removeEventListener('touchend', handleTouchEnd)
            element.removeEventListener('touchcancel', handleTouchCancel)
        }
    }, [ref, onSwipeLeft, onSwipeRight, threshold, disabled])
}
