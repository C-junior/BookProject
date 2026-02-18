import { useRef, useCallback, useState, useEffect } from 'react'

interface PinchZoomOptions {
    minScale?: number
    maxScale?: number
    doubleTapScale?: number
    onScaleChange?: (scale: number) => void
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

function getDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt(dx * dx + dy * dy)
}

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
    maxScale = 5,
    doubleTapScale = 2.5,
    onScaleChange
}: PinchZoomOptions = {}): PinchZoomResult {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const contentRef = useRef<HTMLDivElement | null>(null)

    const [scale, setScaleState] = useState(1)
    const [offsetX, setOffsetX] = useState(0)
    const [offsetY, setOffsetY] = useState(0)

    // Refs for gesture tracking (no re-renders during gestures)
    const gestureState = useRef({
        isPinching: false,
        isPanning: false,
        initialDistance: 0,
        initialScale: 1,
        initialMidX: 0,
        initialMidY: 0,
        panStartX: 0,
        panStartY: 0,
        panInitOffsetX: 0,
        panInitOffsetY: 0,
        lastTapTime: 0,
        lastTapX: 0,
        lastTapY: 0,
        // Current values kept in refs for real-time updates
        currentScale: 1,
        currentOffsetX: 0,
        currentOffsetY: 0,
        animFrameId: 0
    })

    const applyTransform = useCallback(() => {
        const content = contentRef.current
        if (!content) return
        const gs = gestureState.current
        content.style.transform = `translate(${gs.currentOffsetX}px, ${gs.currentOffsetY}px) scale(${gs.currentScale})`
    }, [])

    const clampOffset = useCallback((ox: number, oy: number, s: number) => {
        const container = containerRef.current
        const content = contentRef.current
        if (!container || !content) return { x: ox, y: oy }

        const cw = container.clientWidth
        const ch = container.clientHeight
        // Content's natural (unscaled) size
        const nw = content.scrollWidth / (gestureState.current.currentScale || 1) * s
        const nh = content.scrollHeight / (gestureState.current.currentScale || 1) * s

        if (nw <= cw) {
            ox = 0
        } else {
            const maxOx = (nw - cw) / 2
            ox = clamp(ox, -maxOx, maxOx)
        }

        if (nh <= ch) {
            oy = 0
        } else {
            const maxOy = (nh - ch) / 2
            oy = clamp(oy, -maxOy, maxOy)
        }

        return { x: ox, y: oy }
    }, [])

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
        applyTransform()
        commitState()
    }, [applyTransform, commitState])

    const setScale = useCallback((newScale: number) => {
        const gs = gestureState.current
        const clamped = clamp(newScale, minScale, maxScale)
        gs.currentScale = clamped
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
            if (e.touches.length === 2) {
                // Pinch start
                e.preventDefault()
                gs.isPinching = true
                gs.isPanning = false
                gs.initialDistance = getDistance(e.touches[0], e.touches[1])
                gs.initialScale = gs.currentScale
                const mid = getMidpoint(e.touches[0], e.touches[1])
                gs.initialMidX = mid.x
                gs.initialMidY = mid.y
            } else if (e.touches.length === 1) {
                const now = Date.now()
                const touch = e.touches[0]

                // Double-tap detection
                const dt = now - gs.lastTapTime
                const dx = Math.abs(touch.clientX - gs.lastTapX)
                const dy = Math.abs(touch.clientY - gs.lastTapY)

                if (dt < 300 && dx < 30 && dy < 30) {
                    // Double tap detected
                    e.preventDefault()
                    gs.lastTapTime = 0

                    const container = containerRef.current
                    if (!container) return
                    const rect = container.getBoundingClientRect()
                    const tapX = touch.clientX - rect.left
                    const tapY = touch.clientY - rect.top
                    const centerX = rect.width / 2
                    const centerY = rect.height / 2

                    if (gs.currentScale > 1.05) {
                        // Zoom out to 1
                        gs.currentScale = 1
                        gs.currentOffsetX = 0
                        gs.currentOffsetY = 0
                    } else {
                        // Zoom in to doubleTapScale at tap point
                        gs.currentScale = doubleTapScale
                        gs.currentOffsetX = (centerX - tapX) * (doubleTapScale - 1)
                        gs.currentOffsetY = (centerY - tapY) * (doubleTapScale - 1)
                        const c = clampOffset(gs.currentOffsetX, gs.currentOffsetY, gs.currentScale)
                        gs.currentOffsetX = c.x
                        gs.currentOffsetY = c.y
                    }

                    // Animate smoothly
                    const content = contentRef.current
                    if (content) {
                        content.style.transition = 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)'
                        applyTransform()
                        setTimeout(() => {
                            if (content) content.style.transition = ''
                            commitState()
                        }, 260)
                    }
                    return
                }

                gs.lastTapTime = now
                gs.lastTapX = touch.clientX
                gs.lastTapY = touch.clientY

                // Pan start (only if zoomed)
                if (gs.currentScale > 1.05) {
                    gs.isPanning = true
                    gs.panStartX = touch.clientX
                    gs.panStartY = touch.clientY
                    gs.panInitOffsetX = gs.currentOffsetX
                    gs.panInitOffsetY = gs.currentOffsetY
                }
            }
        }

        const onTouchMove = (e: TouchEvent) => {
            if (gs.isPinching && e.touches.length === 2) {
                e.preventDefault()
                const newDist = getDistance(e.touches[0], e.touches[1])
                const ratio = newDist / gs.initialDistance
                const newScale = clamp(gs.initialScale * ratio, minScale, maxScale)

                // Zoom toward midpoint
                const mid = getMidpoint(e.touches[0], e.touches[1])
                const container = containerRef.current
                if (container) {
                    const rect = container.getBoundingClientRect()
                    const midLocalX = mid.x - rect.left
                    const midLocalY = mid.y - rect.top
                    const centerX = rect.width / 2
                    const centerY = rect.height / 2

                    const scaleDelta = newScale / gs.initialScale
                    gs.currentOffsetX = (centerX - midLocalX) * (scaleDelta - 1) + gs.panInitOffsetX * scaleDelta / gs.initialScale
                    gs.currentOffsetY = (centerY - midLocalY) * (scaleDelta - 1) + gs.panInitOffsetY * scaleDelta / gs.initialScale
                }

                gs.currentScale = newScale
                cancelAnimationFrame(gs.animFrameId)
                gs.animFrameId = requestAnimationFrame(applyTransform)
            } else if (gs.isPanning && e.touches.length === 1) {
                e.preventDefault()
                const touch = e.touches[0]
                const dx = touch.clientX - gs.panStartX
                const dy = touch.clientY - gs.panStartY
                const newOx = gs.panInitOffsetX + dx
                const newOy = gs.panInitOffsetY + dy
                const c = clampOffset(newOx, newOy, gs.currentScale)
                gs.currentOffsetX = c.x
                gs.currentOffsetY = c.y
                cancelAnimationFrame(gs.animFrameId)
                gs.animFrameId = requestAnimationFrame(applyTransform)
            }
        }

        const onTouchEnd = (e: TouchEvent) => {
            if (gs.isPinching) {
                gs.isPinching = false
                // If we still have 1 finger, start panning
                if (e.touches.length === 1 && gs.currentScale > 1.05) {
                    gs.isPanning = true
                    gs.panStartX = e.touches[0].clientX
                    gs.panStartY = e.touches[0].clientY
                    gs.panInitOffsetX = gs.currentOffsetX
                    gs.panInitOffsetY = gs.currentOffsetY
                }
                commitState()
            }
            if (gs.isPanning && e.touches.length === 0) {
                gs.isPanning = false
                // Snap back if zoomed out below 1
                if (gs.currentScale < 1) {
                    gs.currentScale = 1
                    gs.currentOffsetX = 0
                    gs.currentOffsetY = 0
                    const content = contentRef.current
                    if (content) {
                        content.style.transition = 'transform 200ms ease-out'
                        applyTransform()
                        setTimeout(() => {
                            if (content) content.style.transition = ''
                        }, 210)
                    }
                }
                commitState()
            }
        }

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
    }, [minScale, maxScale, doubleTapScale, applyTransform, clampOffset, commitState])

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
