import { useState } from 'react'
import type { Annotation } from '@/types'
import { useReaderStore } from '@/stores/readerStore'
import { X, Bookmark, Trash2, Highlighter } from 'lucide-react'
import './BookmarksPanel.css'

interface BookmarksPanelProps {
    bookmarks: Annotation[]
    highlights?: Annotation[]
    onSelect: (cfi: string) => void
    onDelete: (id: string) => void
    onAddBookmark: () => void
}

export function BookmarksPanel({ bookmarks, highlights = [], onSelect, onDelete, onAddBookmark }: BookmarksPanelProps) {
    const { toggleBookmarks, currentLocation, percentage } = useReaderStore()
    const [activeTab, setActiveTab] = useState<'bookmarks' | 'highlights'>('bookmarks')

    const handleSelect = (cfi: string) => {
        onSelect(cfi)
        toggleBookmarks()
    }

    // Check if current location is bookmarked
    const isCurrentLocationBookmarked = bookmarks.some(b => b.cfiRange === currentLocation)

    // Sort items by creation date (most recent first)
    const sortedBookmarks = [...bookmarks].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    const sortedHighlights = [...highlights].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return (
        <div className="bookmarks-panel">
            <div className="bookmarks-panel-content">
                {/* Header */}
                <div className="bookmarks-header">
                    <h2 className="bookmarks-title">
                        {activeTab === 'bookmarks' ? <Bookmark size={20} /> : <Highlighter size={20} />}
                        Annotations
                    </h2>
                    <button
                        className="bookmarks-close"
                        onClick={toggleBookmarks}
                        aria-label="Close panel"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="bookmarks-tabs">
                    <button
                        className={`bookmarks-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bookmarks')}
                    >
                        Bookmarks ({bookmarks.length})
                    </button>
                    <button
                        className={`bookmarks-tab ${activeTab === 'highlights' ? 'active' : ''}`}
                        onClick={() => setActiveTab('highlights')}
                    >
                        Highlights ({highlights.length})
                    </button>
                </div>

                {activeTab === 'bookmarks' ? (
                    <>
                        {/* Add bookmark button */}
                        <button
                            className={`bookmarks-add-btn ${isCurrentLocationBookmarked ? 'disabled' : ''}`}
                            onClick={onAddBookmark}
                            disabled={isCurrentLocationBookmarked}
                        >
                            <Bookmark size={18} />
                            {isCurrentLocationBookmarked ? 'Page Bookmarked' : 'Bookmark This Page'}
                            <span className="bookmarks-add-position">{percentage}%</span>
                        </button>

                        {/* Bookmarks List */}
                        <div className="bookmarks-list-container">
                            {sortedBookmarks.length === 0 ? (
                                <div className="bookmarks-empty">
                                    <Bookmark size={40} className="bookmarks-empty-icon" />
                                    <p>No bookmarks yet</p>
                                    <span>Tap "Bookmark This Page" to save your reading position</span>
                                </div>
                            ) : (
                                <ul className="bookmarks-list">
                                    {sortedBookmarks.map(bookmark => (
                                        <li key={bookmark.id} className="bookmark-item">
                                            <button
                                                className="bookmark-link"
                                                onClick={() => handleSelect(bookmark.cfiRange || '')}
                                            >
                                                <div className="bookmark-info">
                                                    <span className="bookmark-text">
                                                        {bookmark.text || 'Bookmark'}
                                                    </span>
                                                    {bookmark.note && (
                                                        <span className="bookmark-note">{bookmark.note}</span>
                                                    )}
                                                    <span className="bookmark-date">
                                                        {new Date(bookmark.createdAt).toLocaleDateString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <Bookmark size={16} className="bookmark-icon" fill="currentColor" />
                                            </button>
                                            <button
                                                className="bookmark-delete"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onDelete(bookmark.id)
                                                }}
                                                aria-label="Delete bookmark"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                ) : (
                    /* Highlights List */
                    <div className="bookmarks-list-container">
                        {sortedHighlights.length === 0 ? (
                            <div className="bookmarks-empty">
                                <Highlighter size={40} className="bookmarks-empty-icon" />
                                <p>No highlights yet</p>
                                <span>Select text in the book to highlight it</span>
                            </div>
                        ) : (
                            <ul className="bookmarks-list">
                                {sortedHighlights.map(highlight => (
                                    <li key={highlight.id} className="bookmark-item">
                                        <button
                                            className="bookmark-link highlight-item-link"
                                            onClick={() => handleSelect(highlight.cfiRange || '')}
                                        >
                                            <div className="bookmark-info">
                                                <div className="highlight-text-preview" style={{ borderLeftColor: `var(--color-highlight-${highlight.color || 'yellow'})` }}>
                                                    "{highlight.text}"
                                                </div>
                                                {highlight.note && (
                                                    <span className="bookmark-note">{highlight.note}</span>
                                                )}
                                                <span className="bookmark-date">
                                                    {new Date(highlight.createdAt).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </button>
                                        <button
                                            className="bookmark-delete"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDelete(highlight.id)
                                            }}
                                            aria-label="Delete highlight"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default BookmarksPanel
