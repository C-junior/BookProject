import { useCallback, useRef } from 'react'

interface CropInsets {
    top: number
    right: number
    bottom: number
    left: number
}

interface PdfCropResult {
    cropEnabled: boolean
    cropInsets: CropInsets | null
    detectCrop: (canvas: HTMLCanvasElement) => CropInsets | null
    getCropStyle: () => React.CSSProperties
}

const EMPTY_INSETS: CropInsets = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * Detect content boundaries on a rendered PDF canvas by scanning for non-white pixels.
 * Returns insets as percentages that can be applied via clip-path.
 */
export function usePdfCrop(enabled: boolean): PdfCropResult {
    const cachedInsets = useRef<CropInsets | null>(null)

    const detectCrop = useCallback((canvas: HTMLCanvasElement): CropInsets | null => {
        if (!enabled) {
            cachedInsets.current = null
            return null
        }

        // Use cached if available
        if (cachedInsets.current) return cachedInsets.current

        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return null

        const w = canvas.width
        const h = canvas.height

        // Sample at reduced resolution for performance
        const sampleStep = Math.max(1, Math.floor(Math.min(w, h) / 200))
        const threshold = 240 // pixel brightness threshold (near-white)

        const isContent = (r: number, g: number, b: number) =>
            r < threshold || g < threshold || b < threshold

        let imageData: ImageData
        try {
            imageData = ctx.getImageData(0, 0, w, h)
        } catch {
            return null
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

        // Add small padding (2% of dimension)
        const padX = Math.floor(w * 0.02)
        const padY = Math.floor(h * 0.02)

        const insets: CropInsets = {
            top: Math.max(0, ((topRow - padY) / h) * 100),
            right: Math.max(0, ((w - 1 - rightCol - padX) / w) * 100),
            bottom: Math.max(0, ((h - 1 - bottomRow - padY) / h) * 100),
            left: Math.max(0, ((leftCol - padX) / w) * 100)
        }

        // Only crop if margins are significant (> 3%)
        const hasCroppable = insets.top > 3 || insets.right > 3 || insets.bottom > 3 || insets.left > 3
        if (!hasCroppable) {
            cachedInsets.current = EMPTY_INSETS
            return EMPTY_INSETS
        }

        cachedInsets.current = insets
        return insets
    }, [enabled])

    const getCropStyle = useCallback((): React.CSSProperties => {
        if (!enabled || !cachedInsets.current) return {}
        const { top, right, bottom, left } = cachedInsets.current
        if (top === 0 && right === 0 && bottom === 0 && left === 0) return {}
        return {
            clipPath: `inset(${top}% ${right}% ${bottom}% ${left}%)`
        }
    }, [enabled])

    return {
        cropEnabled: enabled,
        cropInsets: cachedInsets.current,
        detectCrop,
        getCropStyle
    }
}
