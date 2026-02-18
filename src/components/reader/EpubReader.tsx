import { useCallback, useRef, useState, useEffect } from 'react'
import { useReaderStore } from '@/stores/readerStore'
import { useUserStore } from '@/stores/userStore'
import { useAutoSaveBookmark } from '@/hooks/useAutoSaveBookmark'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useEpubInit } from '@/hooks/useEpubInit'
import { useEpubNavigation } from '@/hooks/useEpubNavigation'
import { useEpubAnnotations } from '@/hooks/useEpubAnnotations'
import { useEpubSearch } from '@/hooks/useEpubSearch'
import type { Book, BookmarkColor } from '@/types'
import { auth } from '@/services/firebase'
import { startSession, endSession } from '@/services/storage/db'
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
    const swipeOverlayRef = useRef<HTMLDivElement>(null)
    const currentPercentageRef = useRef(0)
    const sessionIdRef = useRef<number | null>(null)
    const sessionStartPercentageRef = useRef(0)

    const {
        percentage,
        showSettings,
        showToc,
        showBookmarks,
        showSearch,
        preferences,
        toc,
        showAnnotationMenu: showAnnotationMenuFlag,
        annotationMenuPosition,
        selectedText,
        saveCurrentProgress,
        toggleToolbar
    } = useReaderStore()

    const userId = auth.currentUser?.uid || useUserStore.getState().getCurrentUserId()
    const isVerticalScrollMode = preferences.readingMode === 'vertical-scroll'

    // --- Hook: Epub Init (lifecycle, rendition, styles) ---
    const {
        containerRef,
        renditionRef,
        bookRef,
        isLoading,
        error
    } = useEpubInit(book, preferences)

    // --- Hook: Navigation (next/prev/keyboard) ---
    const { goNext, goPrev, goToHref } = useEpubNavigation({
        renditionRef,
        onClose
    })

    // --- Hook: Annotations (highlights, bookmarks, dictionary) ---
    const {
        bookmarks,
        highlights,
        showBookmarkModal,
        editingBookmark,
        dictionaryWord,
        setDictionaryWord,
        handleHighlight,
        handleDismissMenu,
        handleOpenBookmarkModal,
        handleEditBookmark,
        handleSaveBookmark,
        handleCancelBookmarkModal,
        handleDeleteAnnotation,
        handleSelectLocation
    } = useEpubAnnotations({ bookId: book.id, userId, renditionRef })

    // --- Hook: Search ---
    const { handleSearch, handleSearchNavigate } = useEpubSearch({
        bookRef,
        toc,
        renditionRef
    })

    // Auto-save reading position
    useAutoSaveBookmark({
        bookId: book.id,
        userId,
        enabled: preferences.autoSavePosition
    })

    // Prevent screen dimming while reading
    useWakeLock()

    // Swipe + page-flip state
    const [swipeOffset, setSwipeOffset] = useState(0)
    const [pageFlipDirection, setPageFlipDirection] = useState<'next' | 'prev' | null>(null)

    const handleSwipeMove = useCallback((deltaX: number) => {
        const maxOffset = 120
        setSwipeOffset(Math.max(-maxOffset, Math.min(maxOffset, -deltaX)))
    }, [])

    const handleSwipeEnd = useCallback(() => {
        setSwipeOffset(0)
    }, [])

    // Wrap goNext/goPrev to trigger page-flip animation on non-swipe turns
    const handleNext = useCallback(async () => {
        setPageFlipDirection('next')
        await goNext()
        setTimeout(() => setPageFlipDirection(null), 350)
    }, [goNext])

    const handlePrev = useCallback(async () => {
        setPageFlipDirection('prev')
        await goPrev()
        setTimeout(() => setPageFlipDirection(null), 350)
    }, [goPrev])

    useSwipeNavigation({
        ref: swipeOverlayRef,
        onSwipeLeft: goNext,
        onSwipeRight: goPrev,
        onTap: toggleToolbar,
        onSwipeMove: handleSwipeMove,
        onSwipeEnd: handleSwipeEnd,
        disabled: showSettings || showToc || showBookmarks || showSearch || isLoading || !!error || isVerticalScrollMode
    })

    // Auto-save progress periodically
    useEffect(() => {
        const saveInterval = setInterval(() => {
            saveCurrentProgress(userId)
        }, 30000)
        return () => clearInterval(saveInterval)
    }, [saveCurrentProgress, userId])

    // Save on unmount
    useEffect(() => {
        return () => { saveCurrentProgress(userId) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        currentPercentageRef.current = percentage
    }, [percentage])

    // Track reading sessions for stats
    useEffect(() => {
        let cancelled = false

        const begin = async () => {
            try {
                const sessionId = await startSession(book.id, userId)
                if (cancelled) return
                sessionIdRef.current = sessionId
                sessionStartPercentageRef.current = currentPercentageRef.current
            } catch (err) {
                console.error('Failed to start reading session:', err)
            }
        }

        begin()

        return () => {
            cancelled = true
            const sessionId = sessionIdRef.current
            if (!sessionId) return

            const delta = Math.abs(currentPercentageRef.current - sessionStartPercentageRef.current)
            const pagesRead = Math.max(0, Math.round(delta))
            void endSession(sessionId, pagesRead)
            sessionIdRef.current = null
        }
    }, [book.id, userId])

    return (
        <div className="epub-reader" data-theme={preferences.theme}>
            <ReaderToolbar
                book={book}
                onClose={onClose}
                onPrev={handlePrev}
                onNext={handleNext}
            />

            {isLoading && (
                <div className="epub-reader-loading">
                    <Loader2 size={40} className="epub-reader-spinner" />
                    <p>Loading book...</p>
                </div>
            )}

            {error && (
                <div className="epub-reader-error">
                    <AlertCircle size={40} />
                    <p>{error}</p>
                    <button onClick={onClose}>Back to Library</button>
                </div>
            )}

            <div
                ref={containerRef}
                className={[
                    'epub-reader-container',
                    isVerticalScrollMode ? 'vertical-scroll' : '',
                    isLoading || error ? 'hidden' : '',
                    swipeOffset !== 0 ? 'swiping' : '',
                    pageFlipDirection === 'next' ? 'page-flip-next' : '',
                    pageFlipDirection === 'prev' ? 'page-flip-prev' : ''
                ].filter(Boolean).join(' ')}
                style={{
                    transform: swipeOffset !== 0
                        ? `perspective(1200px) translateX(${swipeOffset * 0.4}px) rotateY(${swipeOffset * 0.15}deg)`
                        : undefined,
                    transition: swipeOffset === 0 ? 'transform 0.35s cubic-bezier(.4,0,.2,1)' : 'none'
                }}
            />

            {!isLoading && !error && !isVerticalScrollMode && (
                <div ref={swipeOverlayRef} className="epub-reader-swipe-overlay" />
            )}

            {showSettings && <SettingsPanel />}

            {showToc && <TocPanel toc={toc} onSelect={goToHref} />}

            {showBookmarks && (
                <BookmarksPanel
                    bookTitle={book.title}
                    bookmarks={bookmarks}
                    highlights={highlights}
                    onSelect={handleSelectLocation}
                    onDelete={handleDeleteAnnotation}
                    onAddBookmark={handleOpenBookmarkModal}
                    onEditBookmark={handleEditBookmark}
                />
            )}

            {showSearch && (
                <SearchPanel
                    onSearch={handleSearch}
                    onNavigate={handleSearchNavigate}
                />
            )}

            {showAnnotationMenuFlag && (
                <HighlightMenu
                    position={annotationMenuPosition || { x: window.innerWidth / 2, y: 100 }}
                    onHighlight={handleHighlight}
                    onDefine={(text) => setDictionaryWord(text)}
                    onClose={handleDismissMenu}
                    selectedText={selectedText || ''}
                />
            )}

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

            {dictionaryWord && (
                <DictionaryModal
                    word={dictionaryWord}
                    onClose={() => setDictionaryWord(null)}
                />
            )}

            {preferences.brightness < 100 && (
                <div
                    className="epub-reader-brightness-overlay"
                    style={{ opacity: (100 - preferences.brightness) / 100 }}
                />
            )}

            {!isLoading && !error && (
                <div className="epub-reader-tap-hint">
                    Tap center to show controls
                </div>
            )}
        </div>
    )
}

export default EpubReader
