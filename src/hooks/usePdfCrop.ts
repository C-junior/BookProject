import { useCallback, useRef, useState, useEffect } from 'react'

export interface CropInsets {
    top: number
    right: number
    bottom: number
    left: number
}

interface PdfCropResult {
    cropEnabled: boolean
    cropInsets: CropInsets | null
    detectCrop: (canvas: HTMLCanvasElement) => void
    resetCrop: () => void
    getCropStyle: () => React.CSSProperties
}

const EMPTY_INSETS: CropInsets = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * Detect content boundaries on a rendered PDF canvas by scanning for non-white pixels.
 * Returns insets as percentages that can be applied via clip-path.
 */
export function usePdfCrop(enabled: boolean): PdfCropResult {
    // We use state now to trigger re-renders in parent
    const [insets, setInsets] = useState<CropInsets | null>(null)
    const processingRef = useRef(false)

    // Reset when disabled
    useEffect(() => {
        if (!enabled) setInsets(null)
    }, [enabled])

    const resetCrop = useCallback(() => {
        setInsets(null)
        processingRef.current = false
    }, [])

    const detectCrop = useCallback((canvas: HTMLCanvasElement) => {
        if (!enabled || processingRef.current || insets) return

        processingRef.current = true
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
            processingRef.current = false
            return
        }

        const w = canvas.width
        const h = canvas.height

        // Sample at reduced resolution for performance
        const sampleStep = Math.max(1, Math.floor(Math.min(w, h) / 100)) // finer scan
        const threshold = 250 // strict threshold

        const isContent = (r: number, g: number, b: number) =>
            r < threshold || g < threshold || b < threshold

        let imageData: ImageData
        try {
            imageData = ctx.getImageData(0, 0, w, h)
        } catch {
            processingRef.current = false
            return
        }

        const data = imageData.data
        const pixel = (x: number, y: number) => {
            const i = (y * w + x) * 4
            return { r: data[i], g: data[i + 1], b: data[i + 2] }
        }

        // Scan from top
        let topRow = 0
        outer_top:
        for (let y = 0; y < h; y += sampleStep) {
            for (let x = 0; x < w; x += sampleStep) {
                const { r, g, b } = pixel(x, y)
                if (isContent(r, g, b)) {
                    topRow = y
                    break outer_top
                }
            }
        }

        // Scan from bottom
        let bottomRow = h - 1
        outer_bottom:
        for (let y = h - 1; y >= 0; y -= sampleStep) {
            for (let x = 0; x < w; x += sampleStep) {
                const { r, g, b } = pixel(x, y)
                if (isContent(r, g, b)) {
                    bottomRow = y
                    break outer_bottom
                }
            }
        }

        // Scan from left
        let leftCol = 0
        outer_left:
        for (let x = 0; x < w; x += sampleStep) {
            for (let y = topRow; y <= bottomRow; y += sampleStep) {
                const { r, g, b } = pixel(x, y)
                if (isContent(r, g, b)) {
                    leftCol = x
                    break outer_left
                }
            }
        }

        // Scan from right
        let rightCol = w - 1
        outer_right:
        for (let x = w - 1; x >= 0; x -= sampleStep) {
            for (let y = topRow; y <= bottomRow; y += sampleStep) {
                const { r, g, b } = pixel(x, y)
                if (isContent(r, g, b)) {
                    rightCol = x
                    break outer_right
                }
            }
        }

        // Calculate percentages
        const newInsets: CropInsets = {
            top: parseFloat(((topRow / h) * 100).toFixed(2)),
            right: parseFloat(((w - 1 - rightCol) / w * 100).toFixed(2)),
            bottom: parseFloat(((h - 1 - bottomRow) / h * 100).toFixed(2)),
            left: parseFloat(((leftCol / w) * 100).toFixed(2))
        }

        // Only update if significant crop found (> 2% total) to avoid jitter
        const totalCrop = newInsets.top + newInsets.bottom + newInsets.left + newInsets.right
        if (totalCrop > 2) {
            setInsets(newInsets)
        } else {
            // If insignificant, set to empty to stop re-detecting
            setInsets(EMPTY_INSETS)
        }
        processingRef.current = false
    }, [enabled, insets])

    const getCropStyle = useCallback((): React.CSSProperties => {
        if (!enabled || !insets) return {}
        const { top, right, bottom, left } = insets
        if (top === 0 && right === 0 && bottom === 0 && left === 0) return {}

        // Calculate centering transform
        // We move the canvas so the content center aligns with container center
        // Shift X = (Right - Left) / 2
        // Shift Y = (Bottom - Top) / 2
        const tx = (right - left) / 2
        const ty = (bottom - top) / 2

        return {
            clipPath: `inset(${top}% ${right}% ${bottom}% ${left}%)`,
            transform: `translate(${tx}%, ${ty}%)`
        }
    }, [enabled, insets])

    return {
        cropEnabled: enabled,
        cropInsets: insets,
        detectCrop,
        resetCrop,
        getCropStyle
    }
}
