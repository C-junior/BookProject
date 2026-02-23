import { useEffect, useRef, useCallback, useState } from 'react'
import ePub, { type Rendition, type NavItem } from 'epubjs'
import { useReaderStore } from '@/stores/readerStore'
import type { Book, TocItem, ReaderPreferences } from '@/types'

interface UseEpubInitResult {
    containerRef: React.RefObject<HTMLDivElement | null>
    renditionRef: React.MutableRefObject<Rendition | null>
    bookRef: React.MutableRefObject<any>
    isLoading: boolean
    error: string | null
    locationsGenerated: boolean
    getProgressPercentageFromCfi: (cfi: string) => number | null
}

// Calculate approximate characters per page based on screen size and font size
const calculatePageSize = (width: number, height: number, fontSize: number): number => {
    const area = width * height
    const charArea = fontSize * fontSize
    // Heuristic: (Screen Area / Char Area) * Density Factor
    // Density factor 0.6 accounts for margins, line height, and whitespace
    return Math.max(300, Math.floor((area / charArea) * 0.6))
}

export function useEpubInit(book: Book, preferences: ReaderPreferences): UseEpubInitResult {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const renditionRef = useRef<Rendition | null>(null)
    const bookRef = useRef<any>(null)

    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const locationsGeneratedRef = useRef(false)

    const {
        currentLocation,
        setLocation,
        setToc,
        toggleToolbar,
        hideAnnotationMenu,
        showAnnotationMenuAt
    } = useReaderStore()

    const isVerticalScrollMode = preferences.readingMode === 'vertical-scroll'

    const getProgressPercentageFromCfi = useCallback((cfi: string): number | null => {
        const locationsApi = (bookRef.current as any)?.locations
        if (!locationsApi || !cfi) return null

        // Try 1: Use epub.js built-in percentageFromCfi
        if (typeof locationsApi.percentageFromCfi === 'function') {
            const pct = locationsApi.percentageFromCfi(cfi)
            if (typeof pct === 'number' && Number.isFinite(pct)) {
                return Math.max(0, Math.min(100, Math.round(pct * 100)))
            }
        }

        // Try 2: Use location index from generated locations
        const total = locationsApi._locations?.length
            ?? (typeof locationsApi.total === 'number' ? locationsApi.total : 0)

        if (total < 2 || typeof locationsApi.locationFromCfi !== 'function') return null

        const locationIndex = locationsApi.locationFromCfi(cfi)
        if (typeof locationIndex !== 'number' || !Number.isFinite(locationIndex) || locationIndex < 0) return null

        const percentage = Math.round((locationIndex / (total - 1)) * 100)
        return Math.max(0, Math.min(100, percentage))
    }, [])

    const applyReaderStyles = useCallback((rendition: Rendition) => {
        const themeColors: Record<string, { bg: string; text: string; accent: string }> = {
            light: { bg: '#fffef8', text: '#1a1a1a', accent: '#2563eb' },
            dark: { bg: '#121212', text: '#e0e0e0', accent: '#60a5fa' },
            sepia: { bg: '#f5e6d3', text: '#3d3129', accent: '#8b5a2b' },
            mint: { bg: '#e8f5e9', text: '#1f3a2d', accent: '#2e7d32' },
            warm: { bg: '#fff9c4', text: '#4d3d12', accent: '#8a6d1a' },
            custom: { bg: '#fffef8', text: '#1a1a1a', accent: '#2563eb' }
        }

        const colors = themeColors[preferences.theme] || themeColors.light

        rendition.themes.register('custom', {
            'body': {
                'font-family': `'${preferences.fontFamily}', serif !important`,
                'font-size': `${preferences.fontSize}px !important`,
                'line-height': `${preferences.lineHeight} !important`,
                'text-align': preferences.textAlign,
                'padding': `${preferences.margins}px !important`,
                'background-color': `${colors.bg} !important`,
                'color': `${colors.text} !important`
            },
            'p': {
                'font-family': 'inherit !important',
                'font-size': 'inherit !important',
                'line-height': 'inherit !important',
                'color': `${colors.text} !important`
            },
            'span': { 'color': `${colors.text} !important` },
            'div': { 'color': `${colors.text} !important` },
            'h1, h2, h3, h4, h5, h6': { 'color': `${colors.text} !important` },
            'a': { 'color': `${colors.accent} !important` },
            '.highlight-yellow': { 'fill': '#ffeb3b', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
            '.highlight-green': { 'fill': '#a5d6a7', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
            '.highlight-blue': { 'fill': '#90caf9', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
            '.highlight-pink': { 'fill': '#f48fb1', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
            '.highlight-orange': { 'fill': '#ffcc80', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }
        })
        rendition.themes.select('custom')
    }, [preferences])

    const convertNavToToc = (items: NavItem[], level = 0): TocItem[] => {
        return items.map(item => ({
            id: item.id,
            href: item.href,
            label: item.label,
            level,
            children: item.subitems ? convertNavToToc(item.subitems, level + 1) : undefined
        }))
    }

    // Initialize the book
    useEffect(() => {
        if (!containerRef.current || !book.fileBlob) {
            setError('No book file available')
            setIsLoading(false)
            return
        }

        let isMounted = true

        const initBook = async () => {
            try {
                setIsLoading(true)
                setError(null)

                if (!book.fileBlob) {
                    throw new Error('Book file not available. Please download the book first.')
                }

                const arrayBuffer = await book.fileBlob.arrayBuffer()
                // @ts-expect-error epub.js types are incorrect
                const epubBook = ePub(arrayBuffer)

                if (!isMounted) return

                bookRef.current = epubBook

                // Generate location map for progress & page counting
                try {
                    const locationsApi = (epubBook as any).locations
                    const initialPageSize = calculatePageSize(
                        window.innerWidth,
                        window.innerHeight,
                        preferences.fontSize
                    )

                    if (typeof locationsApi?.generate === 'function') {
                        await locationsApi.generate(initialPageSize)
                        const actualTotal = locationsApi._locations?.length ?? locationsApi.total ?? 0
                        locationsGeneratedRef.current = actualTotal > 0
                    } else {
                        locationsGeneratedRef.current = false
                    }
                } catch (err) {
                    console.error('[EPUB] Failed to generate locations:', err)
                    locationsGeneratedRef.current = false
                }

                // Render to container
                const rendition = epubBook.renderTo(containerRef.current!, {
                    width: '100%',
                    height: '100%',
                    spread: 'none',
                    flow: isVerticalScrollMode ? 'scrolled-doc' : 'paginated',
                    manager: isVerticalScrollMode ? 'continuous' : 'default'
                })
                renditionRef.current = rendition

                applyReaderStyles(rendition)

                const nav = await epubBook.loaded.navigation
                if (!isMounted) return

                setToc(convertNavToToc(nav.toc))

                if (currentLocation) {
                    await rendition.display(currentLocation)
                } else {
                    await rendition.display()
                }

                if (!isMounted) return
                setIsLoading(false)

                // Location changes
                rendition.on('relocated', (location: { start: { cfi: string; percentage: number } }) => {
                    const cfi = location.start.cfi

                    // Try 1: Use generated locations for accurate percentage
                    const cfiBasedPct = locationsGeneratedRef.current
                        ? getProgressPercentageFromCfi(cfi)
                        : null

                    // Try 2: Fallback to epub.js native percentage
                    const startPct = location.start.percentage
                    const nativeFallback = Number.isFinite(startPct)
                        ? Math.max(0, Math.min(100, Math.round(startPct * 100)))
                        : null

                    const percentage = cfiBasedPct ?? nativeFallback ?? 0

                    // Track spine position for chapter-based fallback display
                    let spinePosition = ''
                    try {
                        const cfiMatch = cfi.match(/^epubcfi\(\/\d+\/(\d+)/)
                        if (cfiMatch && bookRef.current?.spine?.length) {
                            const spineIndex = parseInt(cfiMatch[1], 10)
                            const spineLength = bookRef.current.spine.length
                            const chapterNum = Math.max(1, Math.floor((spineIndex - 2) / 2) + 1)
                            spinePosition = `${chapterNum} / ${spineLength}`
                        }
                    } catch { /* ignore */ }

                    const locationsApi = (bookRef.current as any)?.locations
                    const totalPages = locationsApi?.total || 0
                    const locationIndex = typeof locationsApi?.locationFromCfi === 'function'
                        ? locationsApi.locationFromCfi(cfi)
                        : -1
                    const currentPage = (typeof locationIndex === 'number' && locationIndex >= 0)
                        ? locationIndex + 1
                        : 1

                    setLocation(cfi, percentage, undefined, currentPage, totalPages, spinePosition)
                    hideAnnotationMenu()
                })

                // Text selection — compute position for highlight menu
                rendition.on('selected', (cfiRange: string, contents: any) => {
                    const text = contents.range(cfiRange)?.toString() || ''
                    if (!text.trim()) return

                    const iframe = containerRef.current?.querySelector('iframe')
                    const iframeRect = iframe?.getBoundingClientRect()

                    let position: { x: number; y: number } | undefined
                    try {
                        const range = contents.range(cfiRange)
                        const rangeRect = range?.getBoundingClientRect()
                        if (rangeRect && iframeRect) {
                            position = {
                                x: Math.max(40, Math.min(
                                    window.innerWidth - 40,
                                    iframeRect.left + rangeRect.left + rangeRect.width / 2
                                )),
                                y: Math.max(60, iframeRect.top + rangeRect.top)
                            }
                        }
                    } catch {
                        // Fallback: center horizontally, top third of screen
                    }

                    showAnnotationMenuAt(text, cfiRange, position)
                })

                // Tap to toggle toolbar
                rendition.on('click', () => {
                    toggleToolbar()
                    hideAnnotationMenu()
                })

            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Failed to load book')
                    setIsLoading(false)
                }
            }
        }

        initBook()

        return () => {
            isMounted = false
            renditionRef.current?.destroy()
            bookRef.current?.destroy()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [book.id, isVerticalScrollMode, getProgressPercentageFromCfi])

    // Apply preferences changes
    useEffect(() => {
        if (renditionRef.current) {
            applyReaderStyles(renditionRef.current)
        }
    }, [preferences, applyReaderStyles])

    // Handle dynamic page resizing
    useEffect(() => {
        let timeoutId: any

        const handleResize = async () => {
            if (!bookRef.current || !locationsGeneratedRef.current) return

            const newSize = calculatePageSize(
                window.innerWidth,
                window.innerHeight,
                preferences.fontSize
            )

            const locationsApi = (bookRef.current as any).locations
            if (typeof locationsApi?.generate === 'function') {
                try {
                    await locationsApi.generate(newSize)

                    // Force update UI with new page count
                    const currentLocation = useReaderStore.getState().currentLocation
                    if (currentLocation) {
                        const total = locationsApi.total || 0
                        const current = locationsApi.locationFromCfi(currentLocation) + 1
                        useReaderStore.getState().setLocation(
                            currentLocation,
                            useReaderStore.getState().percentage,
                            undefined,
                            current,
                            total
                        )
                    }
                } catch (e) {
                    console.error('Failed to regenerate locations', e)
                }
            }
        }

        const runDebounced = () => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(handleResize, 500)
        }

        // Only run if we actually have a book loaded
        if (locationsGeneratedRef.current) {
            runDebounced()
        }

        window.addEventListener('resize', runDebounced)

        return () => {
            clearTimeout(timeoutId)
            window.removeEventListener('resize', runDebounced)
        }
    }, [preferences.fontSize, book.id])

    return {
        containerRef,
        renditionRef,
        bookRef,
        isLoading,
        error,
        locationsGenerated: locationsGeneratedRef.current,
        getProgressPercentageFromCfi
    }
}
