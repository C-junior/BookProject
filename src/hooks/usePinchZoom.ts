import { useRef, useCallback, useState, useEffect } from 'react'

interface PinchZoomOptions {
    minScale?: number
    maxScale?: number
    doubleTapScale?: number
    onScaleChange?: (scale: number) => void
    onSwipeLeft?: () => void
    onSwipeRight?: () => void
    onTap?: () => void
}

interface PinchZoomResult {
    scale: number
    offsetX: number
    offsetY: number
    isZoomed: boolean
    setScale: (s: number) => void
    resetZoom: () => void
    containerRef: React.RefObject<HTMLDivElement | null>
    contentRef: React.RefObject<HTMLDivElement | null>
}

// Distance between two touch points
function getDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt(dx * dx + dy * dy)
}

// Midpoint between two touch points
function getMidpoint(t1: Touch, t2: Touch) {
    return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
    }
}

function clamp(val: number, min: number, max: number) {
    return Math.min(max, Math.max(min, val))
}

export function usePinchZoom({
    minScale = 0.5,
    maxScale = 10,
    doubleTapScale = 2.5,
    onScaleChange,
    onSwipeLeft,
    onSwipeRight,
    onTap
}: PinchZoomOptions = {}): PinchZoomResult {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const contentRef = useRef<HTMLDivElement | null>(null)

    // React state for external consumers (e.g. settings UI)
    const [scale, setScaleState] = useState(1)
    const [offsetX, setOffsetX] = useState(0)
    const [offsetY, setOffsetY] = useState(0)

    // Gesture state in ref to avoid re-renders during gestures
    const gestureState = useRef({
        isPinching: false,
        isPanning: false,
        initialDistance: 0,
        initialScale: 1,
        // Midpoint of pinch relative to viewport
        initialMidX: 0,
        initialMidY: 0,
        // Start position for pan/swipe
        panStartX: 0,
        panStartY: 0,
        panInitOffsetX: 0,
        panInitOffsetY: 0,
        // Tap tracking
        lastTapTime: 0,
        lastTapX: 0,
        lastTapY: 0,
        swipeStartTime: 0,
        // Current transform values
        currentScale: 1,
        currentOffsetX: 0,
        currentOffsetY: 0,
        animFrameId: 0
    })

    // Apply transform via direct DOM manipulation for 60fps performance
    const applyTransform = useCallback(() => {
        const content = contentRef.current
        if (!content) return
        const gs = gestureState.current
        content.style.transform = `translate(${gs.currentOffsetX}px, ${gs.currentOffsetY}px) scale(${gs.currentScale})`
        // Force hardware acceleration
        content.style.transformOrigin = '0 0'
    }, [])

    // Clamp offsets to keep content within bounds
    const clampOffset = useCallback((ox: number, oy: number, s: number) => {
        const container = containerRef.current
        const content = contentRef.current
        if (!container || !content) return { x: ox, y: oy }

        const cw = container.clientWidth
        const ch = container.clientHeight

        // Content "natural" dimensions at current scale
        const nw = content.scrollWidth * s
        const nh = content.scrollHeight * s

        // Logic:
        // Left edge of content is at `ox`
        // Right edge is at `ox + nw`

        // Horizontal clamping
        if (nw > cw) {
            // Content larger than container: allow panning
            // min ox is cw - nw (right edge aligned with container right)
            // max ox is 0 (left edge aligned with container left)
            ox = Math.min(0, Math.max(cw - nw, ox))
        } else {
            // Content smaller: center it
            ox = (cw - nw) / 2
        }

        // Vertical clamping
        if (nh > ch) {
            oy = Math.min(0, Math.max(ch - nh, oy))
        } else {
            oy = (ch - nh) / 2
        }

        return { x: ox, y: oy }
    }, [])

    // Commit state to React for re-renders
    const commitState = useCallback(() => {
        const gs = gestureState.current
        setScaleState(gs.currentScale)
        setOffsetX(gs.currentOffsetX)
        setOffsetY(gs.currentOffsetY)
        onScaleChange?.(gs.currentScale)
    }, [onScaleChange])

    const resetZoom = useCallback(() => {
        const gs = gestureState.current
        gs.currentScale = 1
        gs.currentOffsetX = 0
        gs.currentOffsetY = 0
        // Center content if scale 1 (assuming fit width usually means full width)
        // Actually at scale 1, pure reset
        const c = clampOffset(0, 0, 1)
        gs.currentOffsetX = c.x
        gs.currentOffsetY = c.y
        applyTransform()
        commitState()
    }, [applyTransform, commitState, clampOffset])

    const setScale = useCallback((newScale: number) => {
        const gs = gestureState.current
        const clamped = clamp(newScale, minScale, maxScale)
        gs.currentScale = clamped

        // Try to keep current center focused? simplified: just clamp offset
        const c = clampOffset(gs.currentOffsetX, gs.currentOffsetY, clamped)
        gs.currentOffsetX = c.x
        gs.currentOffsetY = c.y
        applyTransform()
        commitState()
    }, [minScale, maxScale, applyTransform, clampOffset, commitState])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const gs = gestureState.current

        const onTouchStart = (e: TouchEvent) => {
            // Very important: prevent default to stop browser pinch/scroll
            // But we must allow default if it's a single touch and we're not zoomed?
            // Actually no, we implement custom pan/swipe, so we likely want to prevent default
            // to stop native scrolling, EXCEPT if we want native scrolling behavior?
            // Since this is a "page" viewer, we probably handle all logic.
            // e.preventDefault() // This logic needs to be careful.

            if (e.touches.length === 2) {
                // Pinch Start
                e.preventDefault()
                gs.isPinching = true
                gs.isPanning = false
                gs.initialDistance = getDistance(e.touches[0], e.touches[1])
                gs.initialScale = gs.currentScale
                const mid = getMidpoint(e.touches[0], e.touches[1])

                // Track midpoint relative to content to zoom INTO it
                // We need the point relative to the *transformed* content
                const rect = container.getBoundingClientRect()
                gs.initialMidX = mid.x - rect.left
                gs.initialMidY = mid.y - rect.top

                // Calculate point in content space (untransformed)
                // contentX = (screenX - offsetX) / scale
                // We don't strictly need content coords if we just pivot around screen coords?
                // Let's stick to logic: newOffset = mouse - (mouse - oldOffset) * (newScale / oldScale)
            } else if (e.touches.length === 1) {
                const touch = e.touches[0]
                const now = Date.now()

                // Double tap detection
                const dt = now - gs.lastTapTime
                const dx = Math.abs(touch.clientX - gs.lastTapX)
                const dy = Math.abs(touch.clientY - gs.lastTapY)

                if (dt < 300 && dx < 30 && dy < 30) {
                    // Double Tap!
                    e.preventDefault() // prevent browser zoom/selection
                    gs.lastTapTime = 0 // consume tap

                    const rect = container.getBoundingClientRect()
                    const tapX = touch.clientX - rect.left
                    const tapY = touch.clientY - rect.top

                    let targetScale = doubleTapScale
                    let targetOx = 0
                    let targetOy = 0

                    if (gs.currentScale > 1.05) {
                        // Zoom out
                        targetScale = 1
                        // Recalculate center
                        const c = clampOffset(0, 0, 1)
                        targetOx = c.x
                        targetOy = c.y
                    } else {
                        // Zoom in
                        // Pivot around tap: newOffset = tap - (tap - oldOffset) * (newScale / oldScale)
                        // At scale 1, oldOffset should be ~0 (or centered)
                        const pivotX = (tapX - gs.currentOffsetX)
                        const pivotY = (tapY - gs.currentOffsetY)
                        // contentX at tap is pivotX / currentScale (1) = pivotX
                        // new offset = tapX - pivotX * newScale
                        targetOx = tapX - pivotX * (targetScale / gs.currentScale)
                        targetOy = tapY - pivotY * (targetScale / gs.currentScale)

                        const c = clampOffset(targetOx, targetOy, targetScale)
                        targetOx = c.x
                        targetOy = c.y
                    }

                    // Animate
                    gs.currentScale = targetScale
                    gs.currentOffsetX = targetOx
                    gs.currentOffsetY = targetOy

                    const content = contentRef.current
                    if (content) {
                        content.style.transition = 'transform 300ms cubic-bezier(0.2, 0, 0.2, 1)'
                        applyTransform()
                        setTimeout(() => {
                            if (content) content.style.transition = ''
                            commitState()
                        }, 310)
                    }
                    return
                }

                // Single touch start (Pan or Swipe)
                gs.lastTapTime = now
                gs.lastTapX = touch.clientX
                gs.lastTapY = touch.clientY
                gs.swipeStartTime = now

                gs.isPanning = true
                gs.panStartX = touch.clientX
                gs.panStartY = touch.clientY
                gs.panInitOffsetX = gs.currentOffsetX
                gs.panInitOffsetY = gs.currentOffsetY
            }
        }

        const onTouchMove = (e: TouchEvent) => {
            if (gs.isPinching && e.touches.length === 2) {
                e.preventDefault() // Always prevent on pinch

                const newDist = getDistance(e.touches[0], e.touches[1])
                const scaleFactor = newDist / gs.initialDistance
                // Apply scale factor to initial scale
                let newScale = gs.initialScale * scaleFactor
                newScale = clamp(newScale, minScale, maxScale)

                // Calculate padding to zoom relative to center
                const mid = getMidpoint(e.touches[0], e.touches[1])
                const rect = container.getBoundingClientRect()
                const midX = mid.x - rect.left
                const midY = mid.y - rect.top

                // Move offset to keep mid point stable
                // offset = mouse - (mouse - oldOffset) * (newScale / oldScale)
                // Use initial state to avoid drift? No, incremental is confusing with multiple frames.
                // Let's use initial pinch start state
                // newOffset = mid - (mid - initialOffset) * (newScale / initialScale)

                const ratio = newScale / gs.initialScale
                const newOx = midX - (midX - gs.panInitOffsetX) * ratio // panInitOffsetX stores initial offset at pinch start
                const newOy = midY - (midY - gs.panInitOffsetY) * ratio

                // We don't clamp strictly during pinch to allow overscroll bounce feel?
                // Or strict clamp? Let's strict clamp to avoid flying away
                // Actually, let's clamp lightly or not at all?
                // Clamping is safer.

                // Wait - panInitOffsetX is not set for pinch?
                // We need to store it in onTouchStart pinch block
                // (Let's fix onTouchStart)

                gs.currentScale = newScale
                gs.currentOffsetX = newOx
                gs.currentOffsetY = newOy

                cancelAnimationFrame(gs.animFrameId)
                gs.animFrameId = requestAnimationFrame(applyTransform)

            } else if (gs.isPanning && e.touches.length === 1) {
                // If zoomed, we pan. If not, we might swipe.
                // But wait, if we are at scale 1, we want to allow SWIPE (which is handled by us now)
                // We should preventDefault to capture the swipe, unless we want browser nav?
                // We want custom nav.

                const touch = e.touches[0]
                const dx = touch.clientX - gs.panStartX
                const dy = touch.clientY - gs.panStartY

                // If detecting swipe vs scroll:
                if (gs.currentScale <= 1.05) {
                    // Not zoomed: checks for horizontal swipe
                    // Don't prevent default immediately if it's vertical scroll?
                    // But we want to prevent scroll if we are a fixed reader.
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                        if (Math.abs(dx) > Math.abs(dy)) {
                            // Horizontal - prevents browser nav logic
                            if (e.cancelable) e.preventDefault()
                        }
                    }
                    // Visual feedback for swipe? Optional.
                    // For now, no visual feedback for swipe at scale 1 to keep it simple.
                } else {
                    // Zoomed: Pan
                    if (e.cancelable) e.preventDefault()
                    const newOx = gs.panInitOffsetX + dx
                    const newOy = gs.panInitOffsetY + dy

                    // Helper: resistance at edges?
                    const c = clampOffset(newOx, newOy, gs.currentScale)
                    gs.currentOffsetX = c.x
                    gs.currentOffsetY = c.y

                    cancelAnimationFrame(gs.animFrameId)
                    gs.animFrameId = requestAnimationFrame(applyTransform)
                }
            }
        }

        const onTouchEnd = (e: TouchEvent) => {
            const now = Date.now()

            if (gs.isPinching && e.touches.length < 2) {
                gs.isPinching = false
                // If one finger remains, switch to pan?
                if (e.touches.length === 1) {
                    gs.isPanning = true
                    gs.panStartX = e.touches[0].clientX
                    gs.panStartY = e.touches[0].clientY
                    gs.panInitOffsetX = gs.currentOffsetX
                    gs.panInitOffsetY = gs.currentOffsetY
                } else {
                    commitState()
                }
            } else if (gs.isPanning && e.touches.length === 0) {
                gs.isPanning = false

                // Check for Swipe detection (if scale ~1)
                if (gs.currentScale <= 1.05) {
                    const elapsed = now - gs.swipeStartTime
                    const dx = (e.changedTouches[0]?.clientX || 0) - gs.lastTapX // lastTapX is startX
                    const dy = (e.changedTouches[0]?.clientY || 0) - gs.lastTapY

                    // Tap detection
                    if (elapsed < 300 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                        onTap?.()
                    }
                    // Swipe detection
                    else if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && elapsed < 500) {
                        if (dx > 0) onSwipeRight?.() // Swipe Right (prev)
                        else onSwipeLeft?.() // Swipe Left (next)
                    }
                }

                // Snap back if out of bounds (when panned)
                // (clampOffset handles hard limits during move, but maybe we want rubber band?)
                // For now hard limits are fine.

                commitState()
            }
        }

        // We use { passive: false } to allow e.preventDefault()
        container.addEventListener('touchstart', onTouchStart, { passive: false })
        container.addEventListener('touchmove', onTouchMove, { passive: false })
        container.addEventListener('touchend', onTouchEnd, { passive: true })
        container.addEventListener('touchcancel', onTouchEnd, { passive: true })

        return () => {
            container.removeEventListener('touchstart', onTouchStart)
            container.removeEventListener('touchmove', onTouchMove)
            container.removeEventListener('touchend', onTouchEnd)
            container.removeEventListener('touchcancel', onTouchEnd)
            cancelAnimationFrame(gs.animFrameId)
        }
    }, [minScale, maxScale, doubleTapScale, applyTransform, clampOffset, commitState, onSwipeLeft, onSwipeRight, onTap])

    return {
        scale,
        offsetX,
        offsetY,
        isZoomed: scale > 1.05,
        setScale,
        resetZoom,
        containerRef,
        contentRef
    }
}
