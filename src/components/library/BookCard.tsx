import React from 'react'
import type { Book } from '@/types'
import { BookOpen, MoreVertical, Trash2 } from 'lucide-react'
import './BookCard.css'

interface BookCardProps {
    book: Book
    onOpen: (book: Book) => void
    onDelete: (book: Book) => void
}

export function BookCard({ book, onOpen, onDelete }: BookCardProps) {
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

                {/* Progress indicator if started reading */}
                {book.lastReadAt && (
                    <div className="book-card-progress" aria-label="Reading progress">
                        <div className="book-card-progress-dot" />
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
