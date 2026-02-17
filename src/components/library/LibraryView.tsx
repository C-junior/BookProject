import { useEffect, useState } from 'react'
import { LibrarySkeleton } from './LibrarySkeleton'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUserStore } from '@/stores/userStore'
import type { Book, Collection } from '@/types'
import { BookCard } from './BookCard'
import { CollectionsManager } from './CollectionsManager'
import { CollectionPicker } from './CollectionPicker'
import { Button } from '@/components/ui/Button'
import { DropZone } from '@/components/ui/DropZone'
import { Modal } from '@/components/ui/Modal'
import { SyncIndicator } from '@/components/ui/SyncIndicator'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
import {
    Search,
    Grid3X3,
    List,
    SortAsc,
    Plus,
    BookOpen,
    Loader2,
    LogOut,
    FolderOpen,
    Link2,
    Clock,
    ChevronRight
} from 'lucide-react'
import { parseBookFile } from '@/services/parsers'
import { signOut, auth } from '@/services/firebase'
import { uploadBookFile, uploadCoverImage } from '@/services/storage/storageService'
import {
    getAllCollections,
    createCollection,
    deleteCollection as removeCollection,
    getProgressForBooks,
    updateBook
} from '@/services/storage/db'
import './LibraryView.css'

interface LibraryViewProps {
    onOpenBook: (book: Book) => void
    onLogout?: () => void
}

export function LibraryView({ onOpenBook, onLogout }: LibraryViewProps) {
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
    const activeUserId = auth.currentUser?.uid || currentUser?.id || 'default-user'

    const [showImportModal, setShowImportModal] = useState(false)
    const [showCollectionsManager, setShowCollectionsManager] = useState(false)
    const [importLoading, setImportLoading] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<Book | null>(null)
    const [bookToAddToCollection, setBookToAddToCollection] = useState<Book | null>(null)
    const [importUrl, setImportUrl] = useState('')
    const [urlImporting, setUrlImporting] = useState(false)

    // Collections and progress state
    const [collections, setCollections] = useState<Collection[]>([])
    const [progressMap, setProgressMap] = useState<Record<string, number>>({})

    // Onboarding state
    const [showOnboarding, setShowOnboarding] = useState(false)

    // Check if user is first-time (needs onboarding)
    useEffect(() => {
        const hasCompletedOnboarding = currentUser?.preferences?.hasCompletedOnboarding
        if (!hasCompletedOnboarding && currentUser) {
            // Small delay to let library render first
            const timer = setTimeout(() => setShowOnboarding(true), 500)
            return () => clearTimeout(timer)
        }
    }, [currentUser])

    useEffect(() => {
        loadBooks(activeUserId)
        loadCollectionsList(activeUserId)
    }, [loadBooks, activeUserId])

    // Load progress when books change
    useEffect(() => {
        loadProgressData()
    }, [books, activeUserId])

    // Load collections from IndexedDB
    const loadCollectionsList = async (userId: string) => {
        try {
            const cols = await getAllCollections(userId)
            const unique = new Map<string, Collection>()
            const duplicateIds: string[] = []
            for (const col of cols) {
                const key = col.name.trim().toLowerCase()
                if (!unique.has(key)) {
                    unique.set(key, col)
                } else {
                    duplicateIds.push(col.id)
                }
            }

            // Cleanup historical duplicates for this user (case-insensitive)
            if (duplicateIds.length > 0) {
                for (const id of duplicateIds) {
                    await removeCollection(id)
                }
            }
            setCollections(Array.from(unique.values()))
        } catch (err) {
            console.error('Failed to load collections:', err)
        }
    }

    // Load reading progress from IndexedDB for all books
    const loadProgressData = async () => {
        if (!activeUserId || books.length === 0) {
            setProgressMap({})
            return
        }
        try {
            const bookIds = books.map(book => book.id)
            const allProgress = await getProgressForBooks(activeUserId, bookIds)
            const map: Record<string, number> = {}
            for (const bookId of bookIds) {
                const progress = allProgress[bookId]
                if (progress) {
                    map[bookId] = Math.round(progress.percentage)
                }
            }
            setProgressMap(map)
        } catch (err) {
            console.error('Failed to load progress:', err)
        }
    }

    const handleFilesSelected = async (files: FileList) => {
        setImportLoading(true)
        setImportError(null)

        try {
            for (const file of Array.from(files)) {
                const book = await parseBookFile(file)
                book.userId = activeUserId

                // Upload to Firebase Storage if user is authenticated
                const userId = auth.currentUser?.uid
                if (userId && book.fileBlob) {
                    try {
                        // Upload book file
                        const storageUrl = await uploadBookFile(
                            userId,
                            book.id,
                            book.fileBlob,
                            book.format
                        )
                        book.storageUrl = storageUrl

                        // Upload cover if available
                        if (book.coverBlob) {
                            const coverStorageUrl = await uploadCoverImage(
                                userId,
                                book.id,
                                book.coverBlob
                            )
                            book.coverStorageUrl = coverStorageUrl
                        }

                        console.log(`Uploaded book to Storage: ${book.title}`, book.storageUrl)
                    } catch (uploadErr) {
                        console.error('Failed to upload to Supabase Storage:', uploadErr)
                        console.error('Upload error details:', JSON.stringify(uploadErr, null, 2))
                        // Continue without storage - book will still work locally
                    }
                }

                await addNewBook(book)
            }
            setShowImportModal(false)
        } catch (err) {
            setImportError(err instanceof Error ? err.message : 'Failed to import book')
        } finally {
            setImportLoading(false)
        }
    }

    const handleUrlImport = async () => {
        const url = importUrl.trim()
        if (!url) return

        setUrlImporting(true)
        setImportError(null)

        try {
            const res = await fetch(url)
            if (!res.ok) throw new Error(`Download failed (${res.status})`)

            const blob = await res.blob()
            const filename = url.split('/').pop()?.split('?')[0] || 'book.epub'
            const file = new File([blob], filename, { type: blob.type })

            const book = await parseBookFile(file)
            book.userId = activeUserId

            const userId = auth.currentUser?.uid
            if (userId && book.fileBlob) {
                try {
                    const storageUrl = await uploadBookFile(userId, book.id, book.fileBlob, book.format)
                    book.storageUrl = storageUrl
                    if (book.coverBlob) {
                        const coverStorageUrl = await uploadCoverImage(userId, book.id, book.coverBlob)
                        book.coverStorageUrl = coverStorageUrl
                    }
                } catch (uploadErr) {
                    console.error('Failed to upload to storage:', uploadErr)
                }
            }

            await addNewBook(book)
            setImportUrl('')
            setShowImportModal(false)
        } catch (err) {
            setImportError(err instanceof Error ? err.message : 'Failed to import from URL')
        } finally {
            setUrlImporting(false)
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

    const handleLogout = async () => {
        try {
            await signOut()
            onLogout?.()
        } catch (err) {
            console.error('Failed to sign out:', err)
        }
    }

    const handleCreateCollection = async (name: string, color: string) => {
        try {
            const normalizedName = name.trim().toLowerCase()
            const exists = collections.some(col => col.name.trim().toLowerCase() === normalizedName)
            if (exists) {
                console.warn(`Collection "${name}" already exists for this user`)
                return
            }

            const id = `col_${Date.now()}_${Math.random().toString(36).slice(2)}`
            await createCollection({ id, userId: activeUserId, name, color, createdAt: new Date() })
            await loadCollectionsList(activeUserId)
        } catch (err) {
            if (err instanceof Error && err.message === 'Collection already exists') {
                console.warn(`Collection "${name}" already exists for this user`)
                await loadCollectionsList(activeUserId)
                return
            }
            console.error('Failed to create collection:', err)
        }
    }

    const handleDeleteCollection = async (id: string) => {
        try {
            await removeCollection(id)
            await loadCollectionsList(activeUserId)
        } catch (err) {
            console.error('Failed to delete collection:', err)
        }
    }

    const handleAddToCollection = (book: Book) => {
        // Open the collection picker with this book
        setBookToAddToCollection(book)
    }

    const handleSelectCollection = async (collectionId: string) => {
        if (!bookToAddToCollection) return

        try {
            // Get current collection IDs
            const currentIds = bookToAddToCollection.collectionIds || []

            // Add the new collection ID if not already present
            if (!currentIds.includes(collectionId)) {
                const newCollectionIds = [...currentIds, collectionId]
                await updateBook(bookToAddToCollection.id, { collectionIds: newCollectionIds })

                // Reload books to reflect the change
                await loadBooks(activeUserId)
            }
        } catch (err) {
            console.error('Failed to add book to collection:', err)
        }
    }

    // Onboarding handlers
    const handleOnboardingComplete = async () => {
        setShowOnboarding(false)
        // Save preference to mark onboarding as completed
        try {
            await useUserStore.getState().updateCurrentUserPreferences({
                hasCompletedOnboarding: true
            })
        } catch (err) {
            console.error('Failed to save onboarding preference:', err)
        }
    }

    const handleOnboardingSkip = () => {
        handleOnboardingComplete() // Same behavior - mark as completed
    }

    const filteredBooks = getFilteredBooks()

    // Determine last-read book for hero section
    const { selectedCollection } = useLibraryStore()
    const lastReadBook = !searchQuery && !selectedCollection
        ? books
            .filter(b => b.lastReadAt && progressMap[b.id] && progressMap[b.id] > 0 && progressMap[b.id] < 100 && !b.isCloudOnly)
            .sort((a, b) => new Date(b.lastReadAt!).getTime() - new Date(a.lastReadAt!).getTime())[0] || null
        : null

    return (
        <div className="library">
            {/* Header */}
            <header className="library-header">
                <div className="library-header-top">
                    <div className="library-brand">
                        <img src="/codex_logo.png" alt="Codex Logo" className="library-logo" />
                        <div className="library-greeting">
                            <h1 className="library-title">Codex</h1>
                            <p className="library-subtitle">
                                {currentUser ? `Welcome back, ${currentUser.name}` : 'Your Digital Library'}
                            </p>
                        </div>
                    </div>
                    <div className="library-header-actions">
                        <Button
                            variant="secondary"
                            leftIcon={<FolderOpen size={18} />}
                            onClick={() => setShowCollectionsManager(true)}
                        >
                            Collections
                        </Button>
                        <Button
                            variant="primary"
                            leftIcon={<Plus size={18} />}
                            onClick={() => setShowImportModal(true)}
                        >
                            Add Book
                        </Button>
                        <SyncIndicator />
                        <button
                            className="library-logout-btn"
                            onClick={handleLogout}
                            title="Sign Out"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
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
                {/* Continue Reading Hero */}
                {lastReadBook && !isLoading && !error && (
                    <section className="library-hero" onClick={() => onOpenBook(lastReadBook)}>
                        <div className="library-hero-cover">
                            {(lastReadBook.coverUrl || lastReadBook.coverStorageUrl) ? (
                                <img
                                    src={lastReadBook.coverUrl || lastReadBook.coverStorageUrl}
                                    alt={`Cover of ${lastReadBook.title}`}
                                    className="library-hero-cover-img"
                                />
                            ) : (
                                <div className="library-hero-cover-placeholder">
                                    <BookOpen size={36} />
                                </div>
                            )}
                        </div>
                        <div className="library-hero-info">
                            <div className="library-hero-label">
                                <Clock size={14} />
                                <span>Continue Reading</span>
                            </div>
                            <h2 className="library-hero-title">{lastReadBook.title}</h2>
                            <p className="library-hero-author">{lastReadBook.author || 'Unknown Author'}</p>
                            <div className="library-hero-progress">
                                <div className="library-hero-progress-track">
                                    <div
                                        className="library-hero-progress-fill"
                                        style={{ width: `${progressMap[lastReadBook.id] || 0}%` }}
                                    />
                                </div>
                                <span className="library-hero-progress-text">
                                    {progressMap[lastReadBook.id] || 0}% complete
                                </span>
                            </div>
                            <div className="library-hero-cta">
                                <span>Resume</span>
                                <ChevronRight size={18} />
                            </div>
                        </div>
                    </section>
                )}

                {isLoading ? (
                    <LibrarySkeleton />
                ) : error ? (
                    <div className="library-error">
                        <p>{error}</p>
                        <Button variant="secondary" onClick={() => loadBooks(activeUserId)}>
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
                                progress={progressMap[book.id]}
                                collections={collections}
                                onOpen={onOpenBook}
                                onDelete={setDeleteConfirm}
                                onAddToCollection={handleAddToCollection}
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

                    <div className="import-url-divider">
                        <span>or import from URL</span>
                    </div>

                    <div className="import-url-row">
                        <Link2 size={18} className="import-url-icon" />
                        <input
                            type="url"
                            placeholder="Paste EPUB or PDF link..."
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
                            className="import-url-input"
                            disabled={urlImporting}
                        />
                        <Button
                            variant="primary"
                            onClick={handleUrlImport}
                            disabled={!importUrl.trim() || urlImporting}
                        >
                            {urlImporting ? 'Importing...' : 'Import'}
                        </Button>
                    </div>

                    {(importLoading || urlImporting) && (
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

            {/* Collections Manager Modal */}
            {showCollectionsManager && (
                <CollectionsManager
                    collections={collections}
                    onCreateCollection={handleCreateCollection}
                    onDeleteCollection={handleDeleteCollection}
                    onClose={() => setShowCollectionsManager(false)}
                />
            )}

            {/* Collection Picker Modal */}
            {bookToAddToCollection && (
                <CollectionPicker
                    book={bookToAddToCollection}
                    collections={collections}
                    onSelect={handleSelectCollection}
                    onClose={() => setBookToAddToCollection(null)}
                />
            )}

            {/* Onboarding Tour */}
            {showOnboarding && (
                <OnboardingTour
                    onComplete={handleOnboardingComplete}
                    onSkip={handleOnboardingSkip}
                />
            )}
        </div>
    )
}

export default LibraryView

