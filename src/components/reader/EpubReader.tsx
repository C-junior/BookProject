import { useEffect, useRef, useCallback, useState } from 'react'
import ePub, { type Rendition, type NavItem } from 'epubjs'
import { useReaderStore } from '@/stores/readerStore'
import { useUserStore } from '@/stores/userStore'
import type { Book, TocItem } from '@/types'
import { ReaderToolbar } from './ReaderToolbar'
import { SettingsPanel } from './SettingsPanel'
import { TocPanel } from './TocPanel'
import { Loader2, AlertCircle } from 'lucide-react'
import './EpubReader.css'

interface EpubReaderProps {
    book: Book
    onClose: () => void
}

export function EpubReader({ book, onClose }: EpubReaderProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const renditionRef = useRef<Rendition | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookRef = useRef<any>(null)

    // Loading and error states
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const {
        currentLocation,
        showSettings,
        showToc,
        preferences,
        toc,
        setLocation,
        setToc,
        toggleToolbar,
        saveCurrentProgress
    } = useReaderStore()

    const { getCurrentUserId } = useUserStore()

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

                console.log('Initializing EPUB:', book.title)

                const arrayBuffer = await book.fileBlob.arrayBuffer()
                // @ts-expect-error epub.js types are incorrect, it can be called as a function
                const epubBook = ePub(arrayBuffer)

                if (!isMounted) return

                bookRef.current = epubBook

                // Render to container
                const rendition = epubBook.renderTo(containerRef.current!, {
                    width: '100%',
                    height: '100%',
                    spread: 'none',
                    flow: 'paginated',
                    manager: 'continuous'
                })
                renditionRef.current = rendition

                // Apply initial styles
                applyReaderStyles(rendition)

                // Load table of contents
                const nav = await epubBook.loaded.navigation
                if (!isMounted) return

                const tocItems = convertNavToToc(nav.toc)
                setToc(tocItems)

                // Display at saved location or start
                if (currentLocation) {
                    await rendition.display(currentLocation)
                } else {
                    await rendition.display()
                }

                if (!isMounted) return

                console.log('EPUB loaded successfully')
                setIsLoading(false)

                // Listen for location changes
                rendition.on('relocated', (location: { start: { cfi: string; percentage: number; displayed?: { page?: number } } }) => {
                    setLocation(
                        location.start.cfi,
                        Math.round(location.start.percentage * 100)
                    )
                })

                // Handle click within the iframe for toolbar toggle
                rendition.on('click', () => {
                    toggleToolbar()
                })

            } catch (err) {
                console.error('Error initializing EPUB:', err)
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Failed to load book')
                    setIsLoading(false)
                }
            }
        }

        initBook()

        // Cleanup
        return () => {
            isMounted = false
            if (renditionRef.current) {
                renditionRef.current.destroy()
            }
            if (bookRef.current) {
                bookRef.current.destroy()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [book.id]) // Only re-init when book changes

    // Apply reader preferences when they change
    useEffect(() => {
        if (renditionRef.current) {
            applyReaderStyles(renditionRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferences])

    // Apply CSS styles to the rendition
    const applyReaderStyles = useCallback((rendition: Rendition) => {
        // Get the actual colors based on theme (CSS vars don't work in epub.js iframe)
        const themeColors: Record<string, { bg: string; text: string; accent: string }> = {
            light: { bg: '#fffef8', text: '#1a1a1a', accent: '#2563eb' },
            dark: { bg: '#121212', text: '#e0e0e0', accent: '#60a5fa' },
            sepia: { bg: '#f5e6d3', text: '#3d3129', accent: '#8b5a2b' },
            custom: { bg: '#fffef8', text: '#1a1a1a', accent: '#2563eb' } // fallback for custom
        }

        const colors = themeColors[preferences.theme] || themeColors.light

        // Register theme with actual color values
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
            'span': {
                'color': `${colors.text} !important`
            },
            'div': {
                'color': `${colors.text} !important`
            },
            'h1, h2, h3, h4, h5, h6': {
                'color': `${colors.text} !important`
            },
            'a': {
                'color': `${colors.accent} !important`
            }
        })
        rendition.themes.select('custom')
    }, [preferences])

    // Convert epub.js navigation to our TocItem format
    const convertNavToToc = (items: NavItem[], level = 0): TocItem[] => {
        return items.map(item => ({
            id: item.id,
            href: item.href,
            label: item.label,
            level,
            children: item.subitems ? convertNavToToc(item.subitems, level + 1) : undefined
        }))
    }

    // Navigation handlers
    const goNext = useCallback(async () => {
        if (renditionRef.current) {
            await renditionRef.current.next()
        }
    }, [])

    const goPrev = useCallback(async () => {
        if (renditionRef.current) {
            await renditionRef.current.prev()
        }
    }, [])

    const goToHref = useCallback(async (href: string) => {
        if (renditionRef.current) {
            await renditionRef.current.display(href)
        }
    }, [])

    // Handle keyboard navigation
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

    // Auto-save progress periodically
    useEffect(() => {
        const saveInterval = setInterval(() => {
            saveCurrentProgress(getCurrentUserId())
        }, 30000) // Save every 30 seconds

        return () => clearInterval(saveInterval)
    }, [saveCurrentProgress, getCurrentUserId])

    // Save on unmount
    useEffect(() => {
        return () => {
            saveCurrentProgress(getCurrentUserId())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div
            className="epub-reader"
            data-theme={preferences.theme}
        >
            {/* Toolbar - always rendered but visibility controlled internally */}
            <ReaderToolbar
                book={book}
                onClose={onClose}
                onPrev={goPrev}
                onNext={goNext}
            />

            {/* Loading state */}
            {isLoading && (
                <div className="epub-reader-loading">
                    <Loader2 size={40} className="epub-reader-spinner" />
                    <p>Loading book...</p>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="epub-reader-error">
                    <AlertCircle size={40} />
                    <p>{error}</p>
                    <button onClick={onClose}>Back to Library</button>
                </div>
            )}

            {/* Reading area */}
            <div
                ref={containerRef}
                className={`epub-reader-container ${isLoading || error ? 'hidden' : ''}`}
            />

            {/* Settings Panel */}
            {showSettings && <SettingsPanel />}

            {/* Table of Contents */}
            {showToc && (
                <TocPanel
                    toc={toc}
                    onSelect={goToHref}
                />
            )}

            {/* Brightness overlay */}
            {preferences.brightness < 100 && (
                <div
                    className="epub-reader-brightness-overlay"
                    style={{ opacity: (100 - preferences.brightness) / 100 }}
                />
            )}

            {/* Tap hint overlay - shows briefly on first load */}
            {!isLoading && !error && (
                <div className="epub-reader-tap-hint">
                    Tap center to show controls
                </div>
            )}
        </div>
    )
}

export default EpubReader
