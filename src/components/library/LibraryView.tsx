import React, { useEffect } from 'react'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUserStore } from '@/stores/userStore'
import type { Book } from '@/types'
import { BookCard } from './BookCard'
import { Button } from '@/components/ui/Button'
import { DropZone } from '@/components/ui/DropZone'
import { Modal } from '@/components/ui/Modal'
import {
    Search,
    Grid3X3,
    List,
    SortAsc,
    Plus,
    BookOpen,
    Loader2
} from 'lucide-react'
import { parseBookFile } from '@/services/parsers'
import './LibraryView.css'

interface LibraryViewProps {
    onOpenBook: (book: Book) => void
}

export function LibraryView({ onOpenBook }: LibraryViewProps) {
    const {
        books,
        isLoading,
        error,
        searchQuery,
        sortBy,
        viewMode,
        loadBooks,
        addNewBook,
        removeBook,
        setSearchQuery,
        setSortBy,
        setViewMode,
        getFilteredBooks
    } = useLibraryStore()

    const { currentUser } = useUserStore()

    const [showImportModal, setShowImportModal] = React.useState(false)
    const [importLoading, setImportLoading] = React.useState(false)
    const [importError, setImportError] = React.useState<string | null>(null)
    const [deleteConfirm, setDeleteConfirm] = React.useState<Book | null>(null)

    useEffect(() => {
        loadBooks()
    }, [loadBooks])

    const handleFilesSelected = async (files: FileList) => {
        setImportLoading(true)
        setImportError(null)

        try {
            for (const file of Array.from(files)) {
                const book = await parseBookFile(file)
                await addNewBook(book)
            }
            setShowImportModal(false)
        } catch (err) {
            setImportError(err instanceof Error ? err.message : 'Failed to import book')
        } finally {
            setImportLoading(false)
        }
    }

    const handleDeleteBook = async () => {
        if (!deleteConfirm) return
        try {
            await removeBook(deleteConfirm.id)
            setDeleteConfirm(null)
        } catch (err) {
            console.error('Failed to delete book:', err)
        }
    }

    const filteredBooks = getFilteredBooks()

    return (
        <div className="library">
            {/* Header */}
            <header className="library-header">
                <div className="library-header-top">
                    <div className="library-greeting">
                        <h1 className="library-title">Your Library</h1>
                        <p className="library-subtitle">
                            {currentUser ? `Welcome back, ${currentUser.name}` : 'Welcome to PageTurner'}
                        </p>
                    </div>
                    <Button
                        variant="primary"
                        leftIcon={<Plus size={18} />}
                        onClick={() => setShowImportModal(true)}
                    >
                        Add Book
                    </Button>
                </div>

                {/* Search and filters */}
                <div className="library-toolbar">
                    <div className="library-search">
                        <Search size={18} className="library-search-icon" />
                        <input
                            type="text"
                            placeholder="Search books..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="library-search-input"
                        />
                    </div>

                    <div className="library-filters">
                        <div className="library-sort">
                            <SortAsc size={16} />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                className="library-sort-select"
                            >
                                <option value="addedAt">Date Added</option>
                                <option value="lastReadAt">Last Read</option>
                                <option value="title">Title</option>
                                <option value="author">Author</option>
                            </select>
                        </div>

                        <div className="library-view-toggle">
                            <button
                                className={`library-view-button ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                aria-label="Grid view"
                            >
                                <Grid3X3 size={18} />
                            </button>
                            <button
                                className={`library-view-button ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                                aria-label="List view"
                            >
                                <List size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="library-content">
                {isLoading ? (
                    <div className="library-loading">
                        <Loader2 size={32} className="library-spinner" />
                        <p>Loading your books...</p>
                    </div>
                ) : error ? (
                    <div className="library-error">
                        <p>{error}</p>
                        <Button variant="secondary" onClick={loadBooks}>
                            Try Again
                        </Button>
                    </div>
                ) : filteredBooks.length === 0 ? (
                    <div className="library-empty">
                        <BookOpen size={64} className="library-empty-icon" />
                        <h2 className="library-empty-title">
                            {books.length === 0 ? 'Your library is empty' : 'No books found'}
                        </h2>
                        <p className="library-empty-text">
                            {books.length === 0
                                ? 'Add your first book to get started reading!'
                                : 'Try a different search term'}
                        </p>
                        {books.length === 0 && (
                            <Button
                                variant="primary"
                                leftIcon={<Plus size={18} />}
                                onClick={() => setShowImportModal(true)}
                            >
                                Add Your First Book
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className={`library-grid library-grid-${viewMode}`}>
                        {filteredBooks.map((book) => (
                            <BookCard
                                key={book.id}
                                book={book}
                                onOpen={onOpenBook}
                                onDelete={setDeleteConfirm}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Import Modal */}
            <Modal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                title="Add Books"
                size="md"
            >
                <div className="import-modal-content">
                    <DropZone
                        onFilesSelected={handleFilesSelected}
                        disabled={importLoading}
                    />

                    {importLoading && (
                        <div className="import-loading">
                            <Loader2 size={20} className="library-spinner" />
                            <span>Importing...</span>
                        </div>
                    )}

                    {importError && (
                        <div className="import-error">
                            {importError}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title="Delete Book"
                size="sm"
            >
                <div className="delete-modal-content">
                    <p>
                        Are you sure you want to delete <strong>{deleteConfirm?.title}</strong>?
                        This action cannot be undone.
                    </p>
                    <div className="delete-modal-actions">
                        <Button
                            variant="secondary"
                            onClick={() => setDeleteConfirm(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDeleteBook}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default LibraryView
