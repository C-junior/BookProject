import React from 'react'
import type { Book, Collection } from '@/types'
import { BookOpen, MoreVertical, Trash2, FolderPlus } from 'lucide-react'
import './BookCard.css'

interface BookCardProps {
    book: Book
    progress?: number // 0-100 percentage
    collections?: Collection[]
    onOpen: (book: Book) => void
    onDelete: (book: Book) => void
    onAddToCollection?: (book: Book) => void
}

export function BookCard({ book, progress, collections, onOpen, onDelete, onAddToCollection }: BookCardProps) {
    const [showMenu, setShowMenu] = React.useState(false)
    const menuRef = React.useRef<HTMLDivElement>(null)

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false)
            }
        }

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showMenu])

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowMenu(!showMenu)
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowMenu(false)
        onDelete(book)
    }

    const handleAddToCollection = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowMenu(false)
        onAddToCollection?.(book)
    }

    // Get book's assigned collections
    const bookCollections = collections?.filter(c => book.collectionIds?.includes(c.id)) || []

    return (
        <article className="book-card" onClick={() => onOpen(book)}>
            {/* Cover */}
            <div className="book-card-cover">
                {book.coverUrl ? (
                    <img
                        src={book.coverUrl}
                        alt={`Cover of ${book.title}`}
                        className="book-card-cover-image"
                    />
                ) : (
                    <div className="book-card-cover-placeholder">
                        <BookOpen size={32} />
                        <span className="book-card-cover-format">
                            {book.format.toUpperCase()}
                        </span>
                    </div>
                )}

                {/* Collection badges */}
                {bookCollections.length > 0 && (
                    <div className="book-card-badges">
                        {bookCollections.slice(0, 2).map(col => (
                            <span
                                key={col.id}
                                className="book-card-badge"
                                style={{ backgroundColor: col.color }}
                                title={col.name}
                            />
                        ))}
                        {bookCollections.length > 2 && (
                            <span className="book-card-badge-more">+{bookCollections.length - 2}</span>
                        )}
                    </div>
                )}

                {/* Progress bar (if reading started) */}
                {typeof progress === 'number' && progress > 0 && (
                    <div className="book-card-progress-container">
                        <div
                            className="book-card-progress-bar"
                            style={{ width: `${progress}%` }}
                        />
                        <span className="book-card-progress-text">{progress}%</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="book-card-info">
                <h3 className="book-card-title" title={book.title}>
                    {book.title}
                </h3>
                <p className="book-card-author" title={book.author}>
                    {book.author || 'Unknown Author'}
                </p>
                <div className="book-card-meta">
                    <span className="book-card-format">{book.format.toUpperCase()}</span>
                    <span className="book-card-size">{formatFileSize(book.fileSize)}</span>
                </div>
            </div>

            {/* Menu button */}
            <div className="book-card-menu" ref={menuRef}>
                <button
                    className="book-card-menu-button"
                    onClick={handleMenuClick}
                    aria-label="Book options"
                    aria-expanded={showMenu}
                >
                    <MoreVertical size={18} />
                </button>

                {showMenu && (
                    <div className="book-card-dropdown">
                        {onAddToCollection && (
                            <button
                                className="book-card-dropdown-item"
                                onClick={handleAddToCollection}
                            >
                                <FolderPlus size={16} />
                                <span>Add to Collection</span>
                            </button>
                        )}
                        <button
                            className="book-card-dropdown-item book-card-dropdown-item-danger"
                            onClick={handleDelete}
                        >
                            <Trash2 size={16} />
                            <span>Delete</span>
                        </button>
                    </div>
                )}
            </div>
        </article>
    )
}

export default BookCard

