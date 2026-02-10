import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { useReaderStore } from '@/stores/readerStore'
import { useUserStore } from '@/stores/userStore'
import { useAutoSaveBookmark } from '@/hooks/useAutoSaveBookmark'
import type { Book, Annotation } from '@/types'
import { addAnnotation, deleteAnnotation, getAnnotationsByType } from '@/services/storage/db'
import { auth } from '@/services/firebase'
import { ReaderToolbar } from './ReaderToolbar'
import { SettingsPanel } from './SettingsPanel'
import { BookmarksPanel } from './BookmarksPanel'
import { Loader2, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react'
import './PdfReader.css'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
).toString()

interface PdfReaderProps {
    book: Book
    onClose: () => void
}

export function PdfReader({ book, onClose }: PdfReaderProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

    // State
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [numPages, setNumPages] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [scale, setScale] = useState(1.0)
    const [bookmarks, setBookmarks] = useState<Annotation[]>([])

    const {
        showSettings,
        showBookmarks,
        preferences,
        setLocation,
        toggleToolbar,
        saveCurrentProgress
    } = useReaderStore()

    const userId = auth.currentUser?.uid || useUserStore.getState().getCurrentUserId()
    const pageStorageKey = `pdf-page-${userId}-${book.id}`

    // Calculate percentage
    const percentage = numPages > 0 ? Math.round((currentPage / numPages) * 100) : 0

    // Auto-save reading position as bookmark (if enabled in preferences)
    useAutoSaveBookmark({
        bookId: book.id,
        userId,
        enabled: preferences.autoSavePosition
    })

    // Initialize PDF
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

                // Load saved page or start at page 1
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
            if (pdfDocRef.current) {
                pdfDocRef.current.destroy()
            }
        }
    }, [book.id, book.fileBlob, pageStorageKey])

    // Render current page
    useEffect(() => {
        if (!pdfDocRef.current || !containerRef.current || isLoading) return

        const renderPage = async (pageNum: number) => {
            if (!pdfDocRef.current) return

            try {
                const page = await pdfDocRef.current.getPage(pageNum)
                const viewport = page.getViewport({ scale })

                // Create canvas
                const canvas = document.createElement('canvas')
                canvas.className = 'pdf-page-canvas'
                canvas.width = viewport.width
                canvas.height = viewport.height

                const context = canvas.getContext('2d')
                if (!context) return

                // Clear container and add canvas
                containerRef.current!.innerHTML = ''
                containerRef.current!.appendChild(canvas)

                // Render
                await page.render({
                    canvasContext: context,
                    viewport
                }).promise
            } catch (err) {
                console.error('Error rendering page:', err)
            }
        }

        renderPage(currentPage)
    }, [currentPage, scale, isLoading])

    // Update location and save progress
    useEffect(() => {
        if (numPages > 0) {
            setLocation(currentPage.toString(), percentage)
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

    // Auto-save progress
    useEffect(() => {
        const saveInterval = setInterval(() => {
            saveCurrentProgress(userId)
        }, 30000)

        return () => clearInterval(saveInterval)
    }, [saveCurrentProgress, userId])

    // Navigation
    const goToPage = useCallback((page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, numPages)))
    }, [numPages])

    const goNext = useCallback(() => {
        if (currentPage < numPages) {
            setCurrentPage(prev => prev + 1)
        }
    }, [currentPage, numPages])

    const goPrev = useCallback(() => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1)
        }
    }, [currentPage])

    // Zoom controls
    const zoomIn = useCallback(() => {
        setScale(prev => Math.min(prev + 0.25, 3))
    }, [])

    const zoomOut = useCallback(() => {
        setScale(prev => Math.max(prev - 0.25, 0.5))
    }, [])

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
                    goNext()
                    break
                case '+':
                case '=':
                    zoomIn()
                    break
                case '-':
                    zoomOut()
                    break
                case 'Escape':
                    onClose()
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [goPrev, goNext, zoomIn, zoomOut, onClose])

    // Bookmark handlers
    const handleAddBookmark = useCallback(async () => {
        const newBookmark: Annotation = {
            id: `bookmark-${Date.now()}`,
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
        if (!isNaN(page)) {
            goToPage(page)
        }
    }, [goToPage])

    // Handle click for toolbar toggle
    const handleContainerClick = useCallback(() => {
        toggleToolbar()
    }, [toggleToolbar])

    return (
        <div
            className="pdf-reader"
            data-theme={preferences.theme}
        >
            {/* Toolbar */}
            <ReaderToolbar
                book={book}
                onClose={onClose}
                onPrev={goPrev}
                onNext={goNext}
            />

            {/* Loading state */}
            {isLoading && (
                <div className="pdf-reader-loading">
                    <Loader2 size={40} className="pdf-reader-spinner" />
                    <p>Loading PDF...</p>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="pdf-reader-error">
                    <AlertCircle size={40} />
                    <p>{error}</p>
                    <button onClick={onClose}>Back to Library</button>
                </div>
            )}

            {/* PDF container */}
            {!isLoading && !error && (
                <div className="pdf-reader-wrapper">
                    {/* Zoom controls */}
                    <div className="pdf-zoom-controls">
                        <button onClick={zoomOut} aria-label="Zoom out">
                            <ZoomOut size={18} />
                        </button>
                        <span>{Math.round(scale * 100)}%</span>
                        <button onClick={zoomIn} aria-label="Zoom in">
                            <ZoomIn size={18} />
                        </button>
                    </div>

                    {/* Page container */}
                    <div
                        ref={containerRef}
                        className="pdf-reader-container"
                        onClick={handleContainerClick}
                    />

                    {/* Page indicator */}
                    <div className="pdf-page-indicator">
                        <button
                            onClick={goPrev}
                            disabled={currentPage <= 1}
                            className="pdf-page-btn"
                        >
                            ←
                        </button>
                        <span className="pdf-page-info">
                            <input
                                type="number"
                                value={currentPage}
                                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                                min={1}
                                max={numPages}
                                className="pdf-page-input"
                            />
                            <span>/ {numPages}</span>
                        </span>
                        <button
                            onClick={goNext}
                            disabled={currentPage >= numPages}
                            className="pdf-page-btn"
                        >
                            →
                        </button>
                    </div>
                </div>
            )}

            {/* Settings Panel */}
            {showSettings && <SettingsPanel />}

            {/* Bookmarks Panel */}
            {showBookmarks && (
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
