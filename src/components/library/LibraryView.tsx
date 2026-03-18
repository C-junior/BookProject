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
    FolderOpen,
    Link2,
    Clock,
    ChevronRight,
    ChartColumnBig,
    Sparkles,
    X
} from 'lucide-react'
import { parseBookFile } from '@/services/parsers'
import { auth } from '@/services/firebase'
import { useTranslation } from 'react-i18next'
import { getActiveUserId } from '@/services/auth/session'
import { uploadBookFile, uploadCoverImage } from '@/services/storage/storageService'
import {
    getAllCollections,
    createCollection,
    deleteCollection as removeCollection,
    getProgressForBooks,
    getReadingStatsDetailed,
    updateBook as updateBookInDb
} from '@/services/storage/db'
import { TrialBanner } from '@/components/subscription/TrialBanner'
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt'
import { useNavigationStore } from '@/stores/navigationStore'
import './LibraryView.css'

interface LibraryViewProps {
    onOpenBook: (book: Book) => void
    onLogout?: () => void
}

interface LibraryReadingStats {
    totalBooks: number
    totalTime: number
    totalPages: number
    sessionsCount: number
    averageSessionTime: number
    weeklyActivity: { day: string; minutes: number }[]
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
        updateBookData,
        removeBook,
        setSearchQuery,
        setSortBy,
        setViewMode,
        setSelectedCollection,
        getFilteredBooks
    } = useLibraryStore()

    const { currentUser } = useUserStore()
    const { setActiveTab } = useNavigationStore()
    const activeUserId = getActiveUserId(currentUser?.id)
    const { t } = useTranslation()

    const [showImportModal, setShowImportModal] = useState(false)
    const [showCollectionsManager, setShowCollectionsManager] = useState(false)
    const [showStatsModal, setShowStatsModal] = useState(false)
    const [importLoading, setImportLoading] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<Book | null>(null)
    const [bookToAddToCollection, setBookToAddToCollection] = useState<Book | null>(null)
    const [importUrl, setImportUrl] = useState('')
    const [urlImporting, setUrlImporting] = useState(false)
    const [selectedSmartCollection, setSelectedSmartCollection] = useState<string | null>(null)
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    // Collections and progress state
    const [collections, setCollections] = useState<Collection[]>([])
    const [progressMap, setProgressMap] = useState<Record<string, number>>({})
    const [readingStats, setReadingStats] = useState<LibraryReadingStats | null>(null)

    // Onboarding state
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)

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

    useEffect(() => {
        loadReadingStatsData()
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
                await addNewBook(book)
                void uploadBookAssetsInBackground(book)
            }
            setShowImportModal(false)
        } catch (err) {
            if (err instanceof Error && err.message === 'BOOK_LIMIT_REACHED') {
                setShowImportModal(false)
                setShowUpgradePrompt(true)
            } else {
                setImportError(err instanceof Error ? err.message : 'Failed to import book')
            }
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

            await addNewBook(book)
            void uploadBookAssetsInBackground(book)
            setImportUrl('')
            setShowImportModal(false)
        } catch (err) {
            if (err instanceof Error && err.message === 'BOOK_LIMIT_REACHED') {
                setShowImportModal(false)
                setShowUpgradePrompt(true)
            } else {
                setImportError(err instanceof Error ? err.message : 'Failed to import from URL')
            }
        } finally {
            setUrlImporting(false)
        }
    }

    const handleDeleteBook = async () => {
        if (!deleteConfirm) return
        try {
            const shouldCleanupStorage = Boolean(deleteConfirm.storageUrl || deleteConfirm.coverStorageUrl)
            const storageUserId = auth.currentUser?.uid

            await removeBook(deleteConfirm.id, {
                storageUserId,
                cleanupStorage: shouldCleanupStorage
            })
            setDeleteConfirm(null)
        } catch (err) {
            console.error('Failed to delete book:', err)
        }
    }

    const loadReadingStatsData = async () => {
        if (!activeUserId) return
        try {
            const stats = await getReadingStatsDetailed(activeUserId)
            setReadingStats(stats)
        } catch (err) {
            console.error('Failed to load reading stats:', err)
        }
    }

    const handleRemoveFromDevice = async () => {
        if (!deleteConfirm) return
        try {
            await updateBookData(deleteConfirm.id, {
                fileBlob: undefined,
                coverBlob: undefined,
                isCloudOnly: true,
                coverUrl: shouldKeepCoverUrl(deleteConfirm.coverUrl) ? deleteConfirm.coverUrl : undefined
            })
            setDeleteConfirm(null)
        } catch (err) {
            console.error('Failed to remove local copy:', err)
        }
    }

    const hasCloudCopy = Boolean(deleteConfirm?.storageUrl)
    const isCloudOnlyDelete = Boolean(deleteConfirm?.isCloudOnly || (deleteConfirm && !deleteConfirm.fileBlob && hasCloudCopy))
    const canRemoveLocalOnly = Boolean(deleteConfirm && hasCloudCopy && !isCloudOnlyDelete)

    const uploadBookAssetsInBackground = async (book: Book) => {
        const userId = auth.currentUser?.uid
        if (!userId || !book.fileBlob) return

        try {
            const storageUrl = await uploadBookFile(userId, book.id, book.fileBlob, book.format)
            const updates: Partial<Book> = { storageUrl }

            if (book.coverBlob) {
                const coverStorageUrl = await uploadCoverImage(userId, book.id, book.coverBlob)
                updates.coverStorageUrl = coverStorageUrl
            }

            await updateBookData(book.id, updates)
            console.log(`Uploaded book to Storage: ${book.title}`, storageUrl)
        } catch (uploadErr) {
            console.error('Background upload failed:', uploadErr)
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
                await updateBookInDb(bookToAddToCollection.id, { collectionIds: newCollectionIds })

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
    const smartCollections = [
        { id: 'smart:epub', label: 'EPUB' },
        { id: 'smart:pdf', label: 'PDF' },
        { id: 'smart:cloud', label: t('library.smartCollectionCloud') },
        { id: 'smart:recent', label: t('library.smartCollectionRecent') }
    ]

    const booksForDisplay = filteredBooks.filter((book) => {
        if (!selectedSmartCollection) return true
        switch (selectedSmartCollection) {
            case 'smart:epub':
                return book.format === 'epub'
            case 'smart:pdf':
                return book.format === 'pdf'
            case 'smart:cloud':
                return Boolean(book.isCloudOnly || (!book.fileBlob && book.storageUrl))
            case 'smart:recent': {
                const added = new Date(book.addedAt).getTime()
                const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
                return added >= sevenDaysAgo
            }
            default:
                return true
        }
    })

    // Determine last-read book for hero section
    const { selectedCollection } = useLibraryStore()
    const lastReadBook = !searchQuery && !selectedCollection
        ? books
            .filter(b => b.lastReadAt && progressMap[b.id] && progressMap[b.id] > 0 && progressMap[b.id] < 100 && !b.isCloudOnly)
            .sort((a, b) => new Date(b.lastReadAt!).getTime() - new Date(a.lastReadAt!).getTime())[0] || null
        : null

    const toggleSearch = () => {
        setIsSearchOpen(!isSearchOpen)
        if (isSearchOpen) {
            setSearchQuery('')
        }
    }

    return (
        <div className="library">
            {/* Header */}
            <header className="library-header">
                <div className="library-header-top">
                    <div className="library-brand">
                        <img src="/codex_logo.png" alt="Codex Logo" className="library-logo" />
                        <div className="library-greeting">
                            <div className="library-title-container">
                                <h1 className="library-title">Codex</h1>
                                {currentUser?.isPro && (
                                    <span className="library-pro-badge">PRO</span>
                                )}
                            </div>
                            <p className="library-subtitle">
                                {currentUser ? `Welcome back, ${currentUser.name}` : t('library.yourDigitalLibrary')}
                            </p>
                        </div>
                    </div>
                    <div className="library-header-actions">
                        <Button
                            variant="secondary"
                            leftIcon={<ChartColumnBig size={18} />}
                            className="library-action-btn library-action-btn-icon"
                            onClick={() => setShowStatsModal(true)}
                            aria-label={t('library.openReadingStatistics')}
                            title={t('library.openReadingStatistics')}
                        />
                        <Button
                            variant="secondary"
                            leftIcon={<FolderOpen size={18} />}
                            className="library-action-btn library-action-btn-icon"
                            onClick={() => setShowCollectionsManager(true)}
                            aria-label={t('library.openCollections')}
                            title={t('library.openCollections')}
                        />
                        <Button
                            variant="primary"
                            leftIcon={<Plus size={18} />}
                            className="library-action-btn library-action-btn-primary"
                            onClick={() => setShowImportModal(true)}
                        >
                            {t('library.addBook')}
                        </Button>
                        <SyncIndicator />
                    </div>
                </div>

                {/* Search and filters */}
                <div className={`library-toolbar ${isSearchOpen ? 'search-active' : ''}`}>
                    <div className="library-search-overlay">
                        <div className="library-search-container">
                            <Search size={18} className="library-search-icon" />
                            <input
                                type="text"
                                placeholder={t('library.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="library-search-input"
                                autoFocus={isSearchOpen}
                            />
                            <button className="library-search-close" onClick={toggleSearch}>
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="library-filters">
                        <button
                            className={`library-search-toggle-btn ${isSearchOpen ? 'active' : ''}`}
                            onClick={toggleSearch}
                            aria-label={t('library.searchPlaceholder')}
                            title={t('library.searchPlaceholder')}
                        >
                            <Search size={18} />
                        </button>

                        <div className="library-sort">
                            <SortAsc size={16} />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                className="library-sort-select"
                            >
                                <option value="addedAt">{t('library.sortByDateAdded')}</option>
                                <option value="lastReadAt">{t('library.sortByLastRead')}</option>
                                <option value="title">{t('library.sortByTitle')}</option>
                                <option value="author">{t('library.sortByAuthor')}</option>
                            </select>
                        </div>

                        <div className="library-view-toggle">
                            <button
                                className={`library-view-button ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                aria-label={t('library.gridView')}
                            >
                                <Grid3X3 size={18} />
                            </button>
                            <button
                                className={`library-view-button ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                                aria-label={t('library.listView')}
                            >
                                <List size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="library-collections-bar">
                    <button
                        className={`library-collection-chip ${!selectedCollection && !selectedSmartCollection ? 'active' : ''}`}
                        onClick={() => {
                            setSelectedCollection(null)
                            setSelectedSmartCollection(null)
                        }}
                    >
                        {t('library.allBooks')}
                    </button>
                    {collections.map((col) => (
                        <button
                            key={col.id}
                            className={`library-collection-chip ${selectedCollection === col.id ? 'active' : ''}`}
                            onClick={() => {
                                setSelectedCollection(col.id)
                                setSelectedSmartCollection(null)
                            }}
                            style={{ borderColor: selectedCollection === col.id ? col.color : undefined }}
                        >
                            <span className="library-collection-chip-dot" style={{ backgroundColor: col.color }} />
                            {col.name}
                        </button>
                    ))}
                    {smartCollections.map((smart) => (
                        <button
                            key={smart.id}
                            className={`library-collection-chip ${selectedSmartCollection === smart.id ? 'active' : ''}`}
                            onClick={() => {
                                setSelectedCollection(null)
                                setSelectedSmartCollection(smart.id)
                            }}
                        >
                            <Sparkles size={12} />
                            {smart.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Content */}
            <main className="library-content">
                {/* Trial Banner */}
                <TrialBanner />

                {/* Book Website Button */}
                <button
                    type="button"
                    className="library-website-promo-btn"
                    onClick={() => setActiveTab('store')}
                    aria-label="Open Synthborne in the store"
                    title="Open Chronicles of Synthborne in the store"
                >
                    <div className="library-website-btn-content">
                        <span className="library-website-title">SYNTHBORNE</span>
                        <span className="library-website-subtitle">Open the store page and manage access {'->'}</span>
                    </div>
                </button>

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
                                <span>{t('library.continueReading')}</span>
                            </div>
                            <h2 className="library-hero-title">{lastReadBook.title}</h2>
                            <p className="library-hero-author">{lastReadBook.author || t('library.unknownAuthor')}</p>
                            <div className="library-hero-progress">
                                <div className="library-hero-progress-track">
                                    <div
                                        className="library-hero-progress-fill"
                                        style={{ width: `${progressMap[lastReadBook.id] || 0}%` }}
                                    />
                                </div>
                                <span className="library-hero-progress-text">
                                    {progressMap[lastReadBook.id] || 0}% {t('library.complete')}
                                </span>
                            </div>
                            <div className="library-hero-cta">
                                <span>{t('library.resume')}</span>
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
                            {t('library.tryAgain')}
                        </Button>
                    </div>
                ) : booksForDisplay.length === 0 ? (
                    <div className="library-empty">
                        <BookOpen size={64} className="library-empty-icon" />
                        <h2 className="library-empty-title">
                            {books.length === 0 ? t('library.empty_noBooks_title') : t('library.empty_noSearchResults_title')}
                        </h2>
                        <p className="library-empty-text">
                            {books.length === 0
                                ? t('library.empty_noBooks_desc')
                                : t('library.empty_noSearchResults_desc')}
                        </p>
                        {books.length === 0 && (
                            <Button
                                variant="primary"
                                leftIcon={<Plus size={18} />}
                                onClick={() => setShowImportModal(true)}
                            >
                                {t('library.addYourFirstBook')}
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className={`library-grid library-grid-${viewMode}`}>
                        {booksForDisplay.map((book) => (
                            <BookCard
                                key={book.id}
                                book={book}
                                progress={progressMap[book.id]}
                                collections={collections}
                                onOpen={onOpenBook}
                                onDelete={setDeleteConfirm}
                                onAddToCollection={handleAddToCollection}
                                onUpdateBook={updateBookData}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Import Modal */}
            <Modal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                title={t('library.addBooksModalTitle')}
                size="md"
            >
                <div className="import-modal-content">
                    <DropZone
                        onFilesSelected={handleFilesSelected}
                        disabled={importLoading}
                    />

                    <div className="import-url-divider">
                        <span>{t('library.orImportFromUrl')}</span>
                    </div>

                    <div className="import-url-row">
                        <Link2 size={18} className="import-url-icon" />
                        <input
                            type="url"
                            placeholder={t('library.pasteLinkPlaceholder')}
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
                            {urlImporting ? t('library.importing') : t('library.import')}
                        </Button>
                    </div>

                    {(importLoading || urlImporting) && (
                        <div className="import-loading">
                            <Loader2 size={20} className="library-spinner" />
                            <span>{t('library.importing')}...</span>
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
                title={canRemoveLocalOnly ? t('library.removeBookModalTitle') : t('library.deleteBookModalTitle')}
                size="sm"
            >
                <div className="delete-modal-content">
                    <p>
                        {canRemoveLocalOnly ? (
                            <>
                                {t('library.removeBookConfirmationPrompt', { title: deleteConfirm?.title })}
                            </>
                        ) : isCloudOnlyDelete ? (
                            <>
                                {t('library.deleteCloudBookConfirmationPrompt', { title: deleteConfirm?.title })}
                            </>
                        ) : (
                            <>
                                {t('library.deleteBookConfirmationPrompt', { title: deleteConfirm?.title })}
                            </>
                        )}
                    </p>
                    <div className="delete-modal-actions">
                        <Button
                            variant="secondary"
                            onClick={() => setDeleteConfirm(null)}
                        >
                            {t('library.cancel')}
                        </Button>
                        {canRemoveLocalOnly ? (
                            <>
                                <Button
                                    variant="secondary"
                                    onClick={handleRemoveFromDevice}
                                >
                                    {t('library.removeFromDevice')}
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={handleDeleteBook}
                                >
                                    {t('library.deletePermanently')}
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="danger"
                                onClick={handleDeleteBook}
                            >
                                {t('library.delete')}
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Reading Statistics Modal */}
            <Modal
                isOpen={showStatsModal}
                onClose={() => setShowStatsModal(false)}
                title="Estatisticas"
                size="md"
            >
                <div className="library-stats">
                    {readingStats ? (
                        <div className="library-stats-grid">
                            <article className="library-stat-card">
                                <p className="library-stat-label">Reading Time</p>
                                <p className="library-stat-value">{formatDuration(readingStats.totalTime)}</p>
                            </article>
                            <article className="library-stat-card">
                                <p className="library-stat-label">Sessions</p>
                                <p className="library-stat-value">{readingStats.sessionsCount}</p>
                            </article>
                            <article className="library-stat-card">
                                <p className="library-stat-label">Books Read</p>
                                <p className="library-stat-value">{readingStats.totalBooks}</p>
                            </article>
                            <article className="library-stat-card">
                                <p className="library-stat-label">Avg Session</p>
                                <p className="library-stat-value">{formatDuration(readingStats.averageSessionTime)}</p>
                            </article>
                        </div>
                    ) : (
                        <p className="library-empty-text">No statistics yet.</p>
                    )}
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

            {/* Upgrade Prompt Modal */}
            {showUpgradePrompt && (
                <UpgradePrompt
                    reason="book_limit"
                    onClose={() => setShowUpgradePrompt(false)}
                />
            )}
        </div>
    )
}

export default LibraryView

function shouldKeepCoverUrl(coverUrl?: string): boolean {
    if (!coverUrl) return false
    if (coverUrl.startsWith('blob:')) return false
    if (coverUrl.startsWith('http://localhost') || coverUrl.startsWith('https://localhost')) return false
    return true
}

function formatDuration(totalSeconds: number): string {
    if (totalSeconds <= 0) return '0m'
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    if (hours === 0) return `${minutes}m`
    if (minutes === 0) return `${hours}h`
    return `${hours}h ${minutes}m`
}
