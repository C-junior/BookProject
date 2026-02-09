import { useEffect, useRef, useCallback, useState } from 'react'
import ePub, { type Rendition, type NavItem } from 'epubjs'
import { useReaderStore } from '@/stores/readerStore'
import { useUserStore } from '@/stores/userStore'
import { useAutoSaveBookmark } from '@/hooks/useAutoSaveBookmark'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import type { Book, TocItem, Annotation, SearchResult, HighlightColor, BookmarkColor } from '@/types'
import { addAnnotation, deleteAnnotation, updateAnnotation } from '@/services/storage/db'
import { auth } from '@/services/firebase'
import { ReaderToolbar } from './ReaderToolbar'
import { SettingsPanel } from './SettingsPanel'
import { TocPanel } from './TocPanel'
import { BookmarksPanel } from './BookmarksPanel'
import { BookmarkCreationModal } from './BookmarkCreationModal'
import { SearchPanel } from './SearchPanel'
import { HighlightMenu } from './HighlightMenu'
import { DictionaryModal } from './DictionaryModal'
import { Loader2, AlertCircle } from 'lucide-react'
import './EpubReader.css'

interface EpubReaderProps {
    book: Book
    onClose: () => void
}

export function EpubReader({ book, onClose }: EpubReaderProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const swipeOverlayRef = useRef<HTMLDivElement>(null)
    const renditionRef = useRef<Rendition | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookRef = useRef<any>(null)

    // Loading and error states
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const {
        currentLocation,
        percentage,
        showSettings,
        showToc,
        showBookmarks,
        showSearch,
        preferences,
        toc,
        selectionCfi,
        selectedText,
        setLocation,
        setToc,
        toggleToolbar,
        saveCurrentProgress,
        addAnnotationToState,
        hideAnnotationMenu,
        showAnnotationMenuAt,
        showAnnotationMenu,
        annotations,
        removeAnnotationFromState
    } = useReaderStore()

    const userId = auth.currentUser?.uid || useUserStore.getState().getCurrentUserId()

    // Auto-save reading position as bookmark (if enabled in preferences)
    useAutoSaveBookmark({
        bookId: book.id,
        userId,
        enabled: preferences.autoSavePosition
    })

    // Derived state from store annotations
    const bookmarks = annotations.filter(a => a.type === 'bookmark')
    const highlights = annotations.filter(a => a.type === 'highlight')

    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
    const [swipeOffset, setSwipeOffset] = useState(0)
    const [showBookmarkModal, setShowBookmarkModal] = useState(false)
    const [editingBookmark, setEditingBookmark] = useState<Annotation | null>(null)
    const [dictionaryWord, setDictionaryWord] = useState<string | null>(null)
    const loadedAnnotationIds = useRef<Set<string>>(new Set())

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

                // Check if book has file blob (cloud-only books may not have it)
                if (!book.fileBlob) {
                    throw new Error('Book file not available. Please download the book first.')
                }

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
                    // Hide menu on page turn
                    setMenuPosition(null)
                    hideAnnotationMenu()
                })

                // Listen for text selection
                rendition.on('selected', (cfiRange: string, contents: any) => {
                    // Get selection bounds relative to iframe
                    const range = contents.range(cfiRange)
                    const rect = range.getBoundingClientRect()

                    // Get iframe offset to calculate absolute position
                    const iframe = containerRef.current?.querySelector('iframe')
                    const iframeRect = iframe?.getBoundingClientRect()

                    if (iframeRect) {
                        setMenuPosition({
                            x: iframeRect.left + rect.left + rect.width / 2,
                            y: iframeRect.top + rect.top
                        })

                        showAnnotationMenuAt(range.toString(), cfiRange)

                        // Clear native selection to avoid visual clutter with menu
                        // contents.window.getSelection().removeAllRanges()
                    }
                })

                // Load existing annotations (using cast to any to avoid TS errors)
                const epubAnnotations = (rendition as any).annotations

                // Add existing highlights to rendition
                if (epubAnnotations) {
                    // Use store annotations which should be loaded by now (or load them)
                    // We access them from the store hook in the component scope, but we need the latest value.
                    // Since this is inside useEffect, we should rely on the prop or fetch them.
                    // Let's assume they are passed via props or we can get them from db directly if needed, 
                    // or just use the ones from store which might be empty initially.
                    // Better to rely on a separate effect for annotations? 
                    // No, let's try to add them here if available, or useEffect on [annotations] to sync them.
                }

                // Handle click within the iframe for toolbar toggle
                rendition.on('click', () => {
                    toggleToolbar()
                    // Hide menu if clicked elsewhere
                    setMenuPosition(null)
                    hideAnnotationMenu()
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
            },
            '.highlight-yellow': { 'fill': '#ffeb3b', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
            '.highlight-green': { 'fill': '#a5d6a7', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
            '.highlight-blue': { 'fill': '#90caf9', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
            '.highlight-pink': { 'fill': '#f48fb1', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
            '.highlight-orange': { 'fill': '#ffcc80', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }
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

    // Handle create highlight
    const handleHighlight = useCallback(async (color: HighlightColor) => {
        if (!renditionRef.current || !selectionCfi) return

        try {
            // Create annotation object
            const highlight: Annotation = {
                id: `highlight-${Date.now()}`,
                bookId: book.id,
                userId,
                type: 'highlight',
                cfiRange: selectionCfi,
                text: selectedText,
                color,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            // Save to DB
            await addAnnotation(highlight)

            // Add to state
            addAnnotationToState(highlight);

            // Apply to rendition
            (renditionRef.current as any).annotations.add('highlight', selectionCfi, {}, (e: any) => {
                console.log('Highlight clicked', e)
            }, `highlight-${color}`)

            // Cleanup
            hideAnnotationMenu()
            setMenuPosition(null)

            // Clear selection (this might need to be done on the iframe window)
            const contents = (renditionRef.current as any).getContents()
            contents.forEach((content: any) => {
                content.window.getSelection()?.removeAllRanges()
            })

        } catch (err) {
            console.error('Error adding highlight:', err)
        }
    }, [book.id, userId, selectionCfi, selectedText, addAnnotationToState, hideAnnotationMenu])

    const handleDismissMenu = useCallback(() => {
        hideAnnotationMenu()
        setMenuPosition(null)
        if (renditionRef.current) {
            const contents = (renditionRef.current as any).getContents()
            contents.forEach((content: any) => {
                content.window.getSelection()?.removeAllRanges()
            })
        }
    }, [hideAnnotationMenu])

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

    // Swipe gesture navigation for touch devices
    // Uses an overlay ref instead of containerRef because epub.js iframe blocks touch events
    const handleSwipeMove = useCallback((deltaX: number) => {
        // Clamp the offset to prevent excessive movement
        const maxOffset = 100
        const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, -deltaX))
        setSwipeOffset(clampedOffset)
    }, [])

    const handleSwipeEnd = useCallback(() => {
        setSwipeOffset(0)
    }, [])

    useSwipeNavigation({
        ref: swipeOverlayRef,
        onSwipeLeft: goNext,
        onSwipeRight: goPrev,
        onTap: toggleToolbar,
        onSwipeMove: handleSwipeMove,
        onSwipeEnd: handleSwipeEnd,
        disabled: showSettings || showToc || showBookmarks || showSearch || isLoading || !!error
    })

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
            saveCurrentProgress(userId)
        }, 30000) // Save every 30 seconds

        return () => clearInterval(saveInterval)
    }, [saveCurrentProgress, userId])

    // Save on unmount
    useEffect(() => {
        return () => {
            saveCurrentProgress(userId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])



    // Sync highlights with rendition
    useEffect(() => {
        if (!renditionRef.current || annotations.length === 0) return

        annotations.forEach(annotation => {
            if (annotation.type === 'highlight' && annotation.cfiRange && !loadedAnnotationIds.current.has(annotation.id)) {
                try {
                    (renditionRef.current as any).annotations.add(
                        'highlight',
                        annotation.cfiRange,
                        {},
                        null,
                        `highlight-${annotation.color}`
                    );
                    loadedAnnotationIds.current.add(annotation.id)
                } catch (e) {
                    console.error('Error adding highlight to rendition', e)
                }
            }
        })
    }, [annotations])

    // Open bookmark modal for creating
    const handleOpenBookmarkModal = useCallback(() => {
        if (!currentLocation) return
        setEditingBookmark(null)
        setShowBookmarkModal(true)
    }, [currentLocation])

    // Open bookmark modal for editing
    const handleEditBookmark = useCallback((bookmark: Annotation) => {
        setEditingBookmark(bookmark)
        setShowBookmarkModal(true)
    }, [])

    // Create or update bookmark with name and color
    const handleSaveBookmark = useCallback(async (label: string, color: BookmarkColor) => {
        if (editingBookmark) {
            // Update existing bookmark
            await updateAnnotation(editingBookmark.id, { label, color })
            // Update in state
            removeAnnotationFromState(editingBookmark.id)
            addAnnotationToState({
                ...editingBookmark,
                label,
                color,
                updatedAt: new Date()
            })
        } else {
            // Create new bookmark
            if (!currentLocation) return

            const newBookmark: Annotation = {
                id: `bookmark-${Date.now()}`,
                bookId: book.id,
                userId,
                type: 'bookmark',
                cfiRange: currentLocation,
                text: `Page ${percentage}%`,
                color,
                label,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            await addAnnotation(newBookmark)
            addAnnotationToState(newBookmark)
        }

        setShowBookmarkModal(false)
        setEditingBookmark(null)
    }, [book.id, userId, currentLocation, percentage, addAnnotationToState, removeAnnotationFromState, editingBookmark])

    const handleCancelBookmarkModal = useCallback(() => {
        setShowBookmarkModal(false)
        setEditingBookmark(null)
    }, [])

    // Delete an annotation (bookmark or highlight)
    const handleDeleteAnnotation = useCallback(async (id: string) => {
        // Find the annotation to get its cfi
        const annotation = annotations.find(a => a.id === id)

        // Remove visual highlight from rendition if it's a highlight
        if (annotation?.type === 'highlight' && annotation.cfiRange && renditionRef.current) {
            try {
                (renditionRef.current as any).annotations.remove(annotation.cfiRange, 'highlight')

                // Force re-render of current page to clear visual residue
                if (currentLocation) {
                    await renditionRef.current.display(currentLocation)
                }
            } catch (err) {
                console.error('Error removing highlight from rendition:', err)
            }
        }

        // Remove from DB (this also syncs to Firebase)
        await deleteAnnotation(id)

        // Remove from state
        removeAnnotationFromState(id)

        // Remove from loaded references if it was a highlight
        if (loadedAnnotationIds.current.has(id)) {
            loadedAnnotationIds.current.delete(id)
        }
    }, [annotations, currentLocation, removeAnnotationFromState])

    // Navigate to bookmark/highlight location
    const handleSelectLocation = useCallback(async (cfi: string) => {
        if (renditionRef.current && cfi) {
            await renditionRef.current.display(cfi)
        }
    }, [])

    // Search in book using epub.js
    const handleSearch = useCallback(async (query: string): Promise<SearchResult[]> => {
        if (!bookRef.current || !query.trim()) {
            return []
        }

        try {
            const spine = bookRef.current.spine
            const results: SearchResult[] = []

            // Search through all spine items (chapters)
            for (let i = 0; i < spine.items.length; i++) {
                const item = spine.items[i]
                if (!item) continue

                // Load the document for this spine item (required before find())
                await item.load(bookRef.current.load.bind(bookRef.current))

                // Get the chapter title from TOC
                const chapter = toc.find(t => item.href?.includes(t.href))?.label || `Chapter ${i + 1}`

                // Search using epub.js find method
                const matches = await item.find(query)

                for (const match of matches) {
                    results.push({
                        cfi: match.cfi,
                        excerpt: match.excerpt || '',
                        chapter
                    })
                }

                // Limit results to prevent UI overload
                if (results.length >= 100) break
            }

            return results
        } catch (err) {
            console.error('Search error:', err)
            return []
        }
    }, [toc])

    // Navigate to search result
    const handleSearchNavigate = useCallback(async (cfi: string) => {
        if (renditionRef.current && cfi) {
            await renditionRef.current.display(cfi)
        }
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
                className={`epub-reader-container ${isLoading || error ? 'hidden' : ''} ${swipeOffset !== 0 ? 'swiping' : ''}`}
                style={{
                    transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
                    transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none'
                }}
            />

            {/* Swipe gesture overlay - captures touch events that iframe blocks */}
            {!isLoading && !error && (
                <div
                    ref={swipeOverlayRef}
                    className="epub-reader-swipe-overlay"
                />
            )}

            {/* Settings Panel */}
            {showSettings && <SettingsPanel />}

            {/* Table of Contents */}
            {showToc && (
                <TocPanel
                    toc={toc}
                    onSelect={goToHref}
                />
            )}

            {/* Bookmarks Panel */}
            {showBookmarks && (
                <BookmarksPanel
                    bookmarks={bookmarks}
                    highlights={highlights}
                    onSelect={handleSelectLocation}
                    onDelete={handleDeleteAnnotation}
                    onAddBookmark={handleOpenBookmarkModal}
                    onEditBookmark={handleEditBookmark}
                />
            )}

            {/* Search Panel */}
            {showSearch && (
                <SearchPanel
                    onSearch={handleSearch}
                    onNavigate={handleSearchNavigate}
                />
            )}

            {/* Highlight Menu */}
            {menuPosition && showAnnotationMenu && (
                <HighlightMenu
                    position={menuPosition}
                    onHighlight={handleHighlight}
                    onDefine={(text) => setDictionaryWord(text)}
                    onClose={handleDismissMenu}
                    selectedText={selectedText || ''}
                />
            )}

            {/* Bookmark Creation/Edit Modal */}
            {showBookmarkModal && (
                <BookmarkCreationModal
                    defaultLabel={`Page ${percentage}%`}
                    initialLabel={editingBookmark?.label || ''}
                    initialColor={editingBookmark?.color as BookmarkColor || 'gold'}
                    isEditing={!!editingBookmark}
                    onSave={handleSaveBookmark}
                    onCancel={handleCancelBookmarkModal}
                />
            )}

            {/* Dictionary Modal */}
            {dictionaryWord && (
                <DictionaryModal
                    word={dictionaryWord}
                    onClose={() => setDictionaryWord(null)}
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
