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
    /** Called when user taps (no significant movement) */
    onTap?: () => void
    /** Called during swipe with current offset for animation. Returns deltaX (negative = right, positive = left) */
    onSwipeMove?: (deltaX: number) => void
    /** Called when swipe ends (for cleanup/reset animation) */
    onSwipeEnd?: () => void
    /** Disable swipe detection */
    disabled?: boolean
}

/**
 * Hook for detecting horizontal swipe gestures on touch devices with animation support.
 * Swipe left → onSwipeLeft (next page)
 * Swipe right → onSwipeRight (previous page)
 * Tap → onTap (toggle toolbar)
 * During swipe → onSwipeMove (for animation)
 */
export function useSwipeNavigation({
    ref,
    onSwipeLeft,
    onSwipeRight,
    onTap,
    onSwipeMove,
    onSwipeEnd,
    threshold = 50,
    disabled = false
}: SwipeOptions): void {
    const touchStart = useRef<{ x: number; y: number; time: number } | null>(null)
    const isSwiping = useRef(false)

    useEffect(() => {
        const element = ref.current
        if (!element || disabled) return

        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0]
            if (touch) {
                touchStart.current = {
                    x: touch.clientX,
                    y: touch.clientY,
                    time: Date.now()
                }
                isSwiping.current = false
            }
        }

        const handleTouchMove = (e: TouchEvent) => {
            if (!touchStart.current || !onSwipeMove) return

            const touch = e.touches[0]
            if (!touch) return

            const deltaX = touchStart.current.x - touch.clientX
            const deltaY = Math.abs(touchStart.current.y - touch.clientY)

            // Only track horizontal movement
            if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > deltaY) {
                isSwiping.current = true
                onSwipeMove(deltaX)
            }
        }

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchStart.current) return

            const touch = e.changedTouches[0]
            if (!touch) {
                touchStart.current = null
                onSwipeEnd?.()
                return
            }

            const deltaX = touchStart.current.x - touch.clientX
            const deltaY = Math.abs(touchStart.current.y - touch.clientY)
            const elapsed = Date.now() - touchStart.current.time

            // Check if this was a tap (minimal movement, quick touch)
            const isTap = Math.abs(deltaX) < 15 && deltaY < 15 && elapsed < 300

            if (isTap) {
                onTap?.()
            } else if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > deltaY * 0.7) {
                // Horizontal swipe detected
                if (deltaX > 0) {
                    onSwipeLeft()
                } else {
                    onSwipeRight()
                }
            }

            touchStart.current = null
            isSwiping.current = false
            onSwipeEnd?.()
        }

        const handleTouchCancel = () => {
            touchStart.current = null
            isSwiping.current = false
            onSwipeEnd?.()
        }

        element.addEventListener('touchstart', handleTouchStart, { passive: true })
        element.addEventListener('touchmove', handleTouchMove, { passive: true })
        element.addEventListener('touchend', handleTouchEnd, { passive: true })
        element.addEventListener('touchcancel', handleTouchCancel, { passive: true })

        return () => {
            element.removeEventListener('touchstart', handleTouchStart)
            element.removeEventListener('touchmove', handleTouchMove)
            element.removeEventListener('touchend', handleTouchEnd)
            element.removeEventListener('touchcancel', handleTouchCancel)
        }
    }, [ref, onSwipeLeft, onSwipeRight, onTap, onSwipeMove, onSwipeEnd, threshold, disabled])
}
