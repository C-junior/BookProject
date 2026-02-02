import type { Annotation } from '@/types'
import { useReaderStore } from '@/stores/readerStore'
import { X, Bookmark, Trash2 } from 'lucide-react'
import './BookmarksPanel.css'

interface BookmarksPanelProps {
    bookmarks: Annotation[]
    onSelect: (cfi: string) => void
    onDelete: (id: string) => void
    onAddBookmark: () => void
}

export function BookmarksPanel({ bookmarks, onSelect, onDelete, onAddBookmark }: BookmarksPanelProps) {
    const { toggleBookmarks, currentLocation, percentage } = useReaderStore()

    const handleSelect = (cfi: string) => {
        onSelect(cfi)
        toggleBookmarks()
    }

    // Check if current location is bookmarked
    const isCurrentLocationBookmarked = bookmarks.some(b => b.cfiRange === currentLocation)

    // Sort bookmarks by creation date (most recent first)
    const sortedBookmarks = [...bookmarks].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return (
        <div className="bookmarks-panel">
            <div className="bookmarks-panel-content">
                {/* Header */}
                <div className="bookmarks-header">
                    <h2 className="bookmarks-title">
                        <Bookmark size={20} />
                        Bookmarks
                    </h2>
                    <button
                        className="bookmarks-close"
                        onClick={toggleBookmarks}
                        aria-label="Close bookmarks"
                    >
                        <X size={20} />
                    </button>
                </div>

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
            </div>
        </div>
    )
}

export default BookmarksPanel
