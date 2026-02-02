import { useReaderStore } from '@/stores/readerStore'
import type { Book } from '@/types'
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Settings,
    List,
    Search,
    Bookmark
} from 'lucide-react'
import './ReaderToolbar.css'

interface ReaderToolbarProps {
    book: Book
    onClose: () => void
    onPrev: () => void
    onNext: () => void
}

export function ReaderToolbar({ book, onClose, onPrev, onNext }: ReaderToolbarProps) {
    const {
        showToolbar,
        percentage,
        chapterTitle,
        toggleSettings,
        toggleToc,
        toggleSearch,
        toggleBookmarks
    } = useReaderStore()

    if (!showToolbar) return null

    return (
        <>
            {/* Top toolbar */}
            <header className="reader-toolbar reader-toolbar-top">
                <button
                    className="reader-toolbar-button"
                    onClick={onClose}
                    aria-label="Back to library"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="reader-toolbar-title">
                    <span className="reader-toolbar-book-title">{book.title}</span>
                    {chapterTitle && (
                        <span className="reader-toolbar-chapter">{chapterTitle}</span>
                    )}
                </div>

                <div className="reader-toolbar-actions">
                    <button
                        className="reader-toolbar-button"
                        onClick={toggleSearch}
                        aria-label="Search in book"
                    >
                        <Search size={20} />
                    </button>
                    <button
                        className="reader-toolbar-button"
                        onClick={toggleBookmarks}
                        aria-label="Bookmarks"
                    >
                        <Bookmark size={20} />
                    </button>
                </div>
            </header>

            {/* Bottom toolbar */}
            <footer className="reader-toolbar reader-toolbar-bottom">
                <button
                    className="reader-toolbar-button"
                    onClick={toggleToc}
                    aria-label="Table of contents"
                >
                    <List size={20} />
                </button>

                <div className="reader-toolbar-nav">
                    <button
                        className="reader-toolbar-nav-button"
                        onClick={onPrev}
                        aria-label="Previous page"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    <div className="reader-toolbar-progress">
                        <span className="reader-toolbar-percentage">{percentage}%</span>
                    </div>

                    <button
                        className="reader-toolbar-nav-button"
                        onClick={onNext}
                        aria-label="Next page"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>

                <button
                    className="reader-toolbar-button"
                    onClick={toggleSettings}
                    aria-label="Reader settings"
                >
                    <Settings size={20} />
                </button>
            </footer>

            {/* Progress bar */}
            <div className="reader-progress-bar">
                <div
                    className="reader-progress-fill"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </>
    )
}

export default ReaderToolbar
