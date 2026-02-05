import { useState } from 'react'
import type { Annotation } from '@/types'
import { useReaderStore } from '@/stores/readerStore'
import { X, Bookmark, Trash2, Highlighter, Pencil, Plus } from 'lucide-react'
import './BookmarksPanel.css'

interface BookmarksPanelProps {
    bookmarks: Annotation[]
    highlights?: Annotation[]
    onSelect: (cfi: string) => void
    onDelete: (id: string) => void
    onAddBookmark: () => void
    onEditBookmark?: (bookmark: Annotation) => void
}

export function BookmarksPanel({ bookmarks, highlights = [], onSelect, onDelete, onAddBookmark, onEditBookmark }: BookmarksPanelProps) {
    const { toggleBookmarks, percentage } = useReaderStore()
    const [activeTab, setActiveTab] = useState<'bookmarks' | 'highlights'>('bookmarks')

    const handleSelect = (cfi: string) => {
        onSelect(cfi)
        toggleBookmarks()
    }

    // Separate auto-save bookmark from manual bookmarks
    const autoSaveBookmark = bookmarks.find(b => b.id.startsWith('autosave-'))
    const manualBookmarks = bookmarks.filter(b => !b.id.startsWith('autosave-'))

    // Sort items by creation date (most recent first)
    const sortedBookmarks = [...manualBookmarks].sort(
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
                        {/* Auto-save bookmark (Continue Reading) */}
                        {autoSaveBookmark && (
                            <button
                                className="bookmarks-autosave-card"
                                onClick={() => handleSelect(autoSaveBookmark.cfiRange || '')}
                            >
                                <div className="bookmarks-autosave-icon">
                                    <Bookmark size={20} fill="currentColor" />
                                </div>
                                <div className="bookmarks-autosave-info">
                                    <span className="bookmarks-autosave-label">Continue Reading</span>
                                    <span className="bookmarks-autosave-position">{autoSaveBookmark.text}</span>
                                </div>
                            </button>
                        )}

                        {/* Add bookmark button - always enabled */}
                        <button
                            className="bookmarks-add-btn"
                            onClick={onAddBookmark}
                        >
                            <Plus size={18} />
                            Add New Bookmark
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
                                                    <div className="bookmark-header-row">
                                                        <span
                                                            className="bookmark-color-dot"
                                                            style={{ backgroundColor: `var(--bookmark-color-${bookmark.color})` }}
                                                        />
                                                        <span className="bookmark-label">
                                                            {bookmark.label || bookmark.text || 'Bookmark'}
                                                        </span>
                                                    </div>
                                                    {bookmark.label && (
                                                        <span className="bookmark-position">{bookmark.text}</span>
                                                    )}
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
                                            <div className="bookmark-actions">
                                                {onEditBookmark && (
                                                    <button
                                                        className="bookmark-edit"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onEditBookmark(bookmark)
                                                        }}
                                                        aria-label="Edit bookmark"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                )}
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
                                            </div>
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
