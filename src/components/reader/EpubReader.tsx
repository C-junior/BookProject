import { useCallback, useRef, useState, useEffect } from 'react'
import { useReaderStore } from '@/stores/readerStore'
import { useUserStore } from '@/stores/userStore'
import { useAutoSaveBookmark } from '@/hooks/useAutoSaveBookmark'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { useEpubInit } from '@/hooks/useEpubInit'
import { useEpubNavigation } from '@/hooks/useEpubNavigation'
import { useEpubAnnotations } from '@/hooks/useEpubAnnotations'
import { useEpubSearch } from '@/hooks/useEpubSearch'
import type { Book, BookmarkColor } from '@/types'
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
    const swipeOverlayRef = useRef<HTMLDivElement>(null)

    const {
        percentage,
        showSettings,
        showToc,
        showBookmarks,
        showSearch,
        preferences,
        toc,
        showAnnotationMenu: showAnnotationMenuFlag,
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
        menuPosition,
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

    // Swipe state
    const [swipeOffset, setSwipeOffset] = useState(0)

    const handleSwipeMove = useCallback((deltaX: number) => {
        const maxOffset = 100
        setSwipeOffset(Math.max(-maxOffset, Math.min(maxOffset, -deltaX)))
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

    return (
        <div className="epub-reader" data-theme={preferences.theme}>
            <ReaderToolbar
                book={book}
                onClose={onClose}
                onPrev={goPrev}
                onNext={goNext}
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
                className={`epub-reader-container ${isVerticalScrollMode ? 'vertical-scroll' : ''} ${isLoading || error ? 'hidden' : ''} ${swipeOffset !== 0 ? 'swiping' : ''}`}
                style={{
                    transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
                    transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none'
                }}
            />

            {!isLoading && !error && !isVerticalScrollMode && (
                <div ref={swipeOverlayRef} className="epub-reader-swipe-overlay" />
            )}

            {showSettings && <SettingsPanel />}

            {showToc && <TocPanel toc={toc} onSelect={goToHref} />}

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

            {showSearch && (
                <SearchPanel
                    onSearch={handleSearch}
                    onNavigate={handleSearchNavigate}
                />
            )}

            {menuPosition && showAnnotationMenuFlag && (
                <HighlightMenu
                    position={menuPosition}
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
