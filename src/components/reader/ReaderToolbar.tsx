import { useReaderStore } from '@/stores/readerStore'
import type { Book } from '@/types'
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Settings,
    List,
    Bookmark
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
        chapterTitle,
        toggleSettings,
        toggleToc,
        toggleBookmarks,
        percentage
    } = useReaderStore()
    const { t } = useTranslation()

    if (!showToolbar) return null

    return (
        <>
            {/* Top toolbar */}
            <header className="reader-toolbar reader-toolbar-top">
                <button
                    className="reader-toolbar-button"
                    onClick={onClose}
                    aria-label={t('reader.backToLibrary')}
                    title={t('reader.backToLibrary')}
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
                        onClick={toggleBookmarks}
                        aria-label={t('reader.bookmarks')}
                        title={t('reader.bookmarks')}
                    >
                        <Bookmark size={20} />
                    </button>
                </div>
            </header>

            {/* Bottom toolbar */}
            <footer className="reader-toolbar reader-toolbar-bottom">
                {/* Progress bar as top border */}
                <div className="reader-toolbar-progress-track">
                    <div
                        className="reader-toolbar-progress-fill"
                        style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
                    />
                </div>

                <div className="reader-toolbar-bottom-row">
                    <button
                        className="reader-toolbar-button"
                        onClick={toggleToc}
                        aria-label={t('reader.tableOfContents')}
                        title={t('reader.tableOfContents')}
                    >
                        <List size={20} />
                    </button>

                    <div className="reader-toolbar-nav">
                        <button
                            className="reader-toolbar-nav-button"
                            onClick={onPrev}
                            aria-label={t('reader.previousPage')}
                            title={t('reader.previousPage')}
                        >
                            <ChevronLeft size={24} />
                        </button>

                        <span className="reader-toolbar-progress-label">{percentage}%</span>

                        <button
                            className="reader-toolbar-nav-button"
                            onClick={onNext}
                            aria-label={t('reader.nextPage')}
                            title={t('reader.nextPage')}
                        >
                            <ChevronRight size={24} />
                        </button>
                    </div>

                    <button
                        className="reader-toolbar-button"
                        onClick={toggleSettings}
                        aria-label={t('reader.readerSettings')}
                        title={t('reader.readerSettings')}
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </footer>
        </>
    )
}

export default ReaderToolbar
