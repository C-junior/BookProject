import { useEffect, useCallback } from 'react'
import type { Rendition } from 'epubjs'
import { useReaderStore } from '@/stores/readerStore'

function haptic(ms = 10) {
    navigator.vibrate?.(ms)
}

interface UseEpubNavigationParams {
    renditionRef: React.MutableRefObject<Rendition | null>
    onClose: () => void
}

interface UseEpubNavigationResult {
    goNext: () => Promise<void>
    goPrev: () => Promise<void>
    goToHref: (href: string) => Promise<void>
}

export function useEpubNavigation({
    renditionRef,
    onClose
}: UseEpubNavigationParams): UseEpubNavigationResult {
    const { showSettings, showToc, toggleToolbar } = useReaderStore()

    const goNext = useCallback(async () => {
        if (renditionRef.current) {
            await renditionRef.current.next()
            haptic()
        }
    }, [renditionRef])

    const goPrev = useCallback(async () => {
        if (renditionRef.current) {
            await renditionRef.current.prev()
            haptic()
        }
    }, [renditionRef])

    const goToHref = useCallback(async (href: string) => {
        if (renditionRef.current) {
            await renditionRef.current.display(href)
        }
    }, [renditionRef])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowLeft':
                case 'PageUp':
                    goPrev()
                    break
                case 'ArrowRight':
                case 'PageDown':
                case ' ':
                    if (!showSettings && !showToc) {
                        goNext()
                    }
                    break
                case 'Escape':
                    if (showSettings || showToc) {
                        toggleToolbar()
                    } else {
                        onClose()
                    }
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [goPrev, goNext, showSettings, showToc, toggleToolbar, onClose])

    return { goNext, goPrev, goToHref }
}
