import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { useReaderStore } from '@/stores/readerStore'
import { useUserStore } from '@/stores/userStore'
import { useAutoSaveBookmark } from '@/hooks/useAutoSaveBookmark'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { usePdfCrop } from '@/hooks/usePdfCrop'
import type { Book, Annotation } from '@/types'
import { addAnnotation, deleteAnnotation, getAnnotationsByType, startSession, endSession } from '@/services/storage/db'
import { getActiveUserId } from '@/services/auth/session'
import { ReaderToolbar } from './ReaderToolbar'
import { SettingsPanel } from './SettingsPanel'
import { BookmarksPanel } from './BookmarksPanel'
import {
    Loader2, AlertCircle, Maximize, Columns2,
    SunMedium, Crop, ChevronDown
} from 'lucide-react'
import './PdfReader.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
).toString()

type ZoomPreset = 'fit-width' | 'fit-page' | 'actual' | 'custom'
type ViewMode = 'single' | 'double' | 'comic'

interface PdfReaderProps {
    book: Book
    onClose: () => void
}

function createBookmarkId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `bookmark-${crypto.randomUUID()}`
    }
    return `bookmark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function PdfReader({ book, onClose }: PdfReaderProps) {
    const pageContainerRef = useRef<HTMLDivElement>(null)
    const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
    const sessionIdRef = useRef<number | null>(null)
    const currentPageRef = useRef(1)
    const startPageRef = useRef(1)
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Core state
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [numPages, setNumPages] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [bookmarks, setBookmarks] = useState<Annotation[]>([])

    // PDF-specific settings
    const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('fit-width')
    const [contrast, setContrast] = useState(100)
    const [viewMode, setViewMode] = useState<ViewMode>('single')
    const [cropMargins, setCropMargins] = useState(false)
    const [showPdfSettings, setShowPdfSettings] = useState(false)
    const [controlsVisible, setControlsVisible] = useState(true)

    const {
        showSettings, showBookmarks: showBookmarksPanel, preferences,
        setLocation, toggleToolbar, saveCurrentProgress
    } = useReaderStore()

    const userId = getActiveUserId(useUserStore.getState().getCurrentUserId())
    const pageStorageKey = `pdf-page-${userId}-${book.id}`
    const percentage = numPages > 0 ? Math.round((currentPage / numPages) * 100) : 0
    const maxRenderScaleMultiplier = 4

    // Auto-hide controls
    const resetHideTimer = useCallback(() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        setControlsVisible(true)
        hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500)
    }, [])

    useEffect(() => {
        resetHideTimer()
        return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }
    }, [resetHideTimer])

    // Margin cropping
    const { detectCrop, cropInsets, resetCrop } = usePdfCrop(cropMargins)

    // Navigation callbacks
    const normalizePageForViewMode = useCallback((page: number) => {
        const bounded = Math.max(1, Math.min(page, numPages))
        if (viewMode === 'single') return bounded
        return bounded % 2 === 0 ? Math.max(1, bounded - 1) : bounded
    }, [numPages, viewMode])

    const goNext = useCallback(() => {
        resetCrop()
        const step = viewMode === 'single' ? 1 : 2
        setCurrentPage(prev => {
            const next = viewMode === 'comic'
                ? Math.max(1, prev - step)
                : Math.min(numPages, prev + step)
            if (next !== prev) navigator.vibrate?.(10)
            return next
        })
        resetHideTimer()
    }, [numPages, viewMode, resetHideTimer, resetCrop])

    const goPrev = useCallback(() => {
        resetCrop()
        const step = viewMode === 'single' ? 1 : 2
        setCurrentPage(prev => {
            const next = viewMode === 'comic'
                ? Math.min(numPages, prev + step)
                : Math.max(1, prev - step)
            if (next !== prev) navigator.vibrate?.(10)
            return next
        })
        resetHideTimer()
    }, [numPages, viewMode, resetHideTimer, resetCrop])

    // Pinch zoom
    const {
        scale, setScale, resetZoom,
        containerRef: pinchContainerRef, contentRef: pinchContentRef
    } = usePinchZoom({
        minScale: 0.5,
        maxScale: 10,
        doubleTapScale: 2.5,
        onSwipeLeft: goNext,   // Swipe Left -> Next Page
        onSwipeRight: goPrev,  // Swipe Right -> Prev Page
        onTap: () => {
            toggleToolbar()
            resetHideTimer()
        }
    })

    // Navigation
    const goToPage = useCallback((page: number) => {
        resetCrop()
        setCurrentPage(normalizePageForViewMode(page))
        resetZoom()
    }, [normalizePageForViewMode, resetZoom, resetCrop])

    useEffect(() => { resetZoom() }, [currentPage, resetZoom])
    useEffect(() => { resetCrop() }, [viewMode, resetCrop])
    useEffect(() => { currentPageRef.current = currentPage }, [currentPage])

    useAutoSaveBookmark({ bookId: book.id, userId, enabled: preferences.autoSavePosition })

    // Load PDF
    useEffect(() => {
        if (!book.fileBlob) {
            setError('No PDF file available')
            setIsLoading(false)
            return
        }

        let isMounted = true

        const loadPdf = async () => {
            try {
                setIsLoading(true)
                setError(null)
                const arrayBuffer = await book.fileBlob!.arrayBuffer()
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
                if (!isMounted) return

                pdfDocRef.current = pdf
                setNumPages(pdf.numPages)

                const savedPage = parseInt(localStorage.getItem(pageStorageKey) || '1')
                setCurrentPage(Math.min(savedPage, pdf.numPages))
                setIsLoading(false)
            } catch (err) {
                console.error('Error loading PDF:', err)
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Failed to load PDF')
                    setIsLoading(false)
                }
            }
        }

        loadPdf()
        return () => {
            isMounted = false
            if (pdfDocRef.current) pdfDocRef.current.destroy()
        }
    }, [book.id, book.fileBlob, pageStorageKey])

    // Calculate fit scale based on preset AND crop
    const calculateBaseScale = useCallback((pageWidth: number, pageHeight: number): number => {
        const container = pinchContainerRef.current
        if (!container) return 1

        const cw = container.clientWidth - 16
        const ch = container.clientHeight - 16

        let base = 1
        switch (zoomPreset) {
            case 'fit-width':
                base = cw / pageWidth
                break
            case 'fit-page':
                base = Math.min(cw / pageWidth, ch / pageHeight)
                break
            case 'actual':
                base = 1
                break
            case 'custom':
                base = 1
                break
            default:
                base = cw / pageWidth
        }

        // Apply crop zoom
        if (cropMargins && cropInsets) {
            const { left, right } = cropInsets
            const widthRatio = (100 - left - right) / 100
            if (widthRatio > 0.1) {
                base = base / widthRatio
            }
        }

        return base
    }, [zoomPreset, pinchContainerRef, cropMargins, cropInsets])

    useEffect(() => { if (cropInsets) resetZoom() }, [cropInsets, resetZoom])

    // Render pages
    useEffect(() => {
        if (!pdfDocRef.current || !pageContainerRef.current || isLoading) return

        const renderPages = async (pageNum: number) => {
            if (!pdfDocRef.current) return

            try {
                const pagesToRender: number[] = []

                if (viewMode === 'single') {
                    pagesToRender.push(pageNum)
                } else {
                    const anchor = pageNum % 2 === 0 ? pageNum - 1 : pageNum
                    if (anchor >= 1 && anchor <= numPages) pagesToRender.push(anchor)
                    if (anchor + 1 <= numPages) pagesToRender.push(anchor + 1)
                    if (viewMode === 'comic') pagesToRender.reverse()
                }

                const wrapper = document.createElement('div')
                wrapper.className = `pdf-pages pdf-pages-${viewMode}`

                pageContainerRef.current!.innerHTML = ''
                pageContainerRef.current!.appendChild(wrapper)

                for (const targetPage of pagesToRender) {
                    const page = await pdfDocRef.current!.getPage(targetPage)
                    const baseViewport = page.getViewport({ scale: 1 })

                    const renderScale = calculateBaseScale(baseViewport.width, baseViewport.height)
                    const cssViewport = page.getViewport({ scale: renderScale })

                    // Render at higher backing resolution so zoom remains sharp.
                    const dpr = window.devicePixelRatio || 1
                    const zoomBoost = Math.max(1, Math.min(scale, maxRenderScaleMultiplier))
                    const outputScale = dpr * zoomBoost
                    const renderViewport = page.getViewport({ scale: renderScale * outputScale })

                    // Create Frame (The visible viewport of the page)
                    const pageFrame = document.createElement('div')
                    pageFrame.className = 'pdf-page-frame'
                    pageFrame.style.position = 'relative'
                    pageFrame.style.overflow = 'hidden'
                    // Apply visual styles to FRAME, as Canvas will be larger and clipped
                    pageFrame.style.boxShadow = 'var(--shadow-md)'
                    pageFrame.style.borderRadius = '2px'
                    pageFrame.style.backgroundColor = 'var(--pdf-page-bg)'

                    const canvas = document.createElement('canvas')
                    // NO CLASS to avoid CSS max-width conflicts
                    canvas.width = Math.floor(renderViewport.width)
                    canvas.height = Math.floor(renderViewport.height)

                    // Essential for cropping: take canvas out of flow
                    // Build the FULL canvas cssText from scratch
                    // (setting individual props then cssText would overwrite them)
                    let canvasStyle = `position:absolute;top:0;left:0;transform-origin:0 0;max-width:none;max-height:none;width:${cssViewport.width}px;height:${cssViewport.height}px;`

                    if (contrast !== 100) {
                        canvasStyle += `filter: contrast(${contrast}%);`
                    }

                    if (cropMargins && cropInsets) {
                        const { left, right, top, bottom } = cropInsets
                        // 1. Set Frame Size to CONTENT size
                        const netW = cssViewport.width * (1 - (left + right) / 100)
                        const netH = cssViewport.height * (1 - (top + bottom) / 100)

                        pageFrame.style.width = `${netW}px`
                        pageFrame.style.height = `${netH}px`

                        // 2. Shift Canvas so content aligns to frame
                        canvasStyle += `transform: translate(-${left}%, -${top}%);`
                    } else {
                        // Full size
                        pageFrame.style.width = `${cssViewport.width}px`
                        pageFrame.style.height = `${cssViewport.height}px`
                    }

                    canvas.style.cssText = canvasStyle

                    const context = canvas.getContext('2d')
                    if (!context) continue

                    pageFrame.appendChild(canvas)
                    wrapper.appendChild(pageFrame)

                    await page.render({ canvasContext: context, viewport: renderViewport }).promise

                    // Detect crop on first page
                    if (cropMargins && !cropInsets && targetPage === pagesToRender[0]) {
                        detectCrop(canvas)
                    }
                }
            } catch (err) {
                console.error('Error rendering page:', err)
            }
        }

        renderPages(currentPage)
    }, [currentPage, contrast, viewMode, numPages, isLoading, zoomPreset, cropMargins, calculateBaseScale, detectCrop, cropInsets, scale])

    // Save progress
    useEffect(() => {
        if (numPages > 0) {
            setLocation(currentPage.toString(), percentage, undefined, currentPage, numPages)
            localStorage.setItem(pageStorageKey, currentPage.toString())
        }
    }, [currentPage, numPages, percentage, pageStorageKey, setLocation])

    // Load bookmarks
    useEffect(() => {
        const loadBookmarks = async () => {
            const annotations = await getAnnotationsByType(book.id, userId, 'bookmark')
            setBookmarks(annotations)
        }
        loadBookmarks()
    }, [book.id, userId])

    // Auto-save interval
    useEffect(() => {
        const saveInterval = setInterval(() => saveCurrentProgress(userId), 30000)
        return () => clearInterval(saveInterval)
    }, [saveCurrentProgress, userId])

    // Reading session tracking
    useEffect(() => {
        let cancelled = false
        const begin = async () => {
            try {
                const sessionId = await startSession(book.id, userId)
                if (cancelled) return
                sessionIdRef.current = sessionId
                startPageRef.current = currentPageRef.current
            } catch (err) {
                console.error('Failed to start reading session:', err)
            }
        }
        begin()
        return () => {
            cancelled = true
            const sessionId = sessionIdRef.current
            if (!sessionId) return
            const pagesRead = Math.max(0, Math.abs(currentPageRef.current - startPageRef.current))
            void endSession(sessionId, pagesRead)
            sessionIdRef.current = null
        }
    }, [book.id, userId])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowLeft': case 'PageUp': goPrev(); break
                case 'ArrowRight': case 'PageDown': case ' ': goNext(); break
                case '+': case '=': setScale(scale + 0.25); break
                case '-': setScale(scale - 0.25); break
                case 'Escape': onClose(); break
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [goPrev, goNext, setScale, scale, onClose])

    // Bookmark handlers
    const handleAddBookmark = useCallback(async () => {
        const newBookmark: Annotation = {
            id: createBookmarkId(),
            bookId: book.id,
            userId,
            type: 'bookmark',
            pageNumber: currentPage,
            cfiRange: currentPage.toString(),
            text: `Page ${currentPage}`,
            color: 'yellow',
            createdAt: new Date(),
            updatedAt: new Date()
        }
        await addAnnotation(newBookmark)
        setBookmarks(prev => [...prev, newBookmark])
    }, [book.id, userId, currentPage])

    const handleDeleteBookmark = useCallback(async (id: string) => {
        await deleteAnnotation(id)
        setBookmarks(prev => prev.filter(b => b.id !== id))
    }, [])

    const handleSelectBookmark = useCallback((cfi: string) => {
        const page = parseInt(cfi)
        if (!isNaN(page)) goToPage(page)
    }, [goToPage])

    // Zoom preset handlers
    const handleZoomPreset = useCallback((preset: ZoomPreset) => {
        setZoomPreset(preset)
        resetZoom()
    }, [resetZoom])

    // View mode label
    const viewModeLabels: Record<ViewMode, string> = {
        single: 'Single',
        double: 'Spread',
        comic: 'Comic RTL'
    }

    const zoomPresetLabels: Record<ZoomPreset, string> = {
        'fit-width': 'Fit Width',
        'fit-page': 'Fit Page',
        'actual': 'Actual Size',
        'custom': `${Math.round(scale * 100)}%`
    }

    return (
        <div className="pdf-reader" data-theme={preferences.theme}>
            {/* Toolbar — auto-hides */}
            <ReaderToolbar book={book} onClose={onClose} onPrev={goPrev} onNext={goNext} />

            {/* Loading */}
            {isLoading && (
                <div className="pdf-reader-loading">
                    <Loader2 size={40} className="pdf-reader-spinner" />
                    <p>Loading PDF...</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="pdf-reader-error">
                    <AlertCircle size={40} />
                    <p>{error}</p>
                    <button onClick={onClose}>Back to Library</button>
                </div>
            )}

            {/* Main PDF area */}
            {!isLoading && !error && (
                <div className="pdf-reader-wrapper">
                    {/* Pinch-zoom container - now handles taps/swipes internally via hooks */}
                    <div
                        ref={pinchContainerRef}
                        className="pdf-pinch-container"
                    >
                        <div ref={pinchContentRef} className="pdf-pinch-content">
                            <div ref={pageContainerRef} className="pdf-reader-container" />
                        </div>
                    </div>

                    {/* Minimal page indicator pill */}
                    <div className={`pdf-page-pill ${controlsVisible ? 'visible' : 'hidden'}`}>
                        <span
                            className="pdf-page-pill-prev"
                            onPointerDown={(e) => { e.stopPropagation(); goPrev() }}
                        >
                            ‹
                        </span>
                        <span className="pdf-page-pill-text">
                            <input
                                type="number"
                                value={currentPage}
                                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                                min={1}
                                max={numPages}
                                className="pdf-page-pill-input"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span className="pdf-page-pill-sep">/ {numPages}</span>
                        </span>
                        <span
                            className="pdf-page-pill-next"
                            onPointerDown={(e) => { e.stopPropagation(); goNext() }}
                        >
                            ›
                        </span>
                    </div>

                    {/* PDF Settings toggle (bottom-right FAB) */}
                    <button
                        className={`pdf-settings-fab ${controlsVisible ? 'visible' : 'hidden'}`}
                        onClick={(e) => { e.stopPropagation(); setShowPdfSettings(!showPdfSettings) }}
                        aria-label="PDF settings"
                    >
                        <ChevronDown
                            size={20}
                            style={{ transform: showPdfSettings ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms' }}
                        />
                    </button>

                    {/* PDF Settings bottom sheet */}
                    {showPdfSettings && (
                        <>
                            <div
                                className="pdf-settings-backdrop"
                                onClick={() => setShowPdfSettings(false)}
                            />
                            <div className="pdf-settings-sheet">
                                <div className="pdf-settings-handle" />

                                {/* Zoom Presets */}
                                <div className="pdf-settings-section">
                                    <span className="pdf-settings-label">
                                        <Maximize size={14} /> Zoom
                                    </span>
                                    <div className="pdf-settings-chips">
                                        {(['fit-width', 'fit-page', 'actual'] as ZoomPreset[]).map(p => (
                                            <button
                                                key={p}
                                                className={`pdf-chip ${zoomPreset === p ? 'active' : ''}`}
                                                onClick={() => handleZoomPreset(p)}
                                            >
                                                {zoomPresetLabels[p]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* View Mode */}
                                <div className="pdf-settings-section">
                                    <span className="pdf-settings-label">
                                        <Columns2 size={14} /> View
                                    </span>
                                    <div className="pdf-settings-chips">
                                        {(['single', 'double', 'comic'] as ViewMode[]).map(m => (
                                            <button
                                                key={m}
                                                className={`pdf-chip ${viewMode === m ? 'active' : ''}`}
                                                onClick={() => setViewMode(m)}
                                            >
                                                {viewModeLabels[m]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Contrast */}
                                <div className="pdf-settings-section">
                                    <span className="pdf-settings-label">
                                        <SunMedium size={14} /> Contrast
                                        <span className="pdf-settings-value">{contrast}%</span>
                                    </span>
                                    <input
                                        type="range"
                                        min="80"
                                        max="180"
                                        step="5"
                                        value={contrast}
                                        onChange={(e) => setContrast(parseInt(e.target.value))}
                                        className="pdf-settings-slider"
                                    />
                                </div>

                                {/* Crop Margins */}
                                <div className="pdf-settings-section">
                                    <span className="pdf-settings-label">
                                        <Crop size={14} /> Crop Margins
                                    </span>
                                    <button
                                        className={`pdf-crop-toggle ${cropMargins ? 'active' : ''}`}
                                        onClick={() => setCropMargins(!cropMargins)}
                                        role="switch"
                                        aria-checked={cropMargins}
                                    >
                                        <span className="pdf-crop-toggle-thumb" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Existing settings & bookmarks panels */}
            {showSettings && <SettingsPanel />}
            {showBookmarksPanel && (
                <BookmarksPanel
                    bookTitle={book.title}
                    bookmarks={bookmarks}
                    onSelect={handleSelectBookmark}
                    onDelete={handleDeleteBookmark}
                    onAddBookmark={handleAddBookmark}
                />
            )}

            {/* Brightness overlay */}
            {preferences.brightness < 100 && (
                <div
                    className="pdf-reader-brightness-overlay"
                    style={{ opacity: (100 - preferences.brightness) / 100 }}
                />
            )}
        </div>
    )
}

export default PdfReader
