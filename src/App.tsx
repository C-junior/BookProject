import { useEffect, useState, lazy, Suspense } from 'react'
import { useUserStore } from '@/stores/userStore'
import { useReaderStore } from '@/stores/readerStore'
import { LibraryView } from '@/components/library/LibraryView'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { UpdateToast } from '@/components/ui/UpdateToast'
import { syncOnLogin, syncOnLogout } from '@/services/sync/syncService'
import { downloadBookFile } from '@/services/storage/storageService'
import { updateBook } from '@/services/storage/db'
import { auth } from '@/services/firebase'
import type { Book } from '@/types'
import './App.css'

// Lazy-load heavy components — epub.js & pdfjs only download when needed
const EpubReader = lazy(() => import('@/components/reader/EpubReader'))
const PdfReader = lazy(() => import('@/components/reader/PdfReader'))
const LoginScreen = lazy(() => import('@/components/auth/LoginScreen'))
const ShareTarget = lazy(() => import('@/components/ui/ShareTarget').then(m => ({ default: m.ShareTarget })))

function App() {
    const { loadUsers, currentUser } = useUserStore()
    const { isReading, currentBook, openBook, closeBook, preferences } = useReaderStore()
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [showUpdateToast, setShowUpdateToast] = useState(false)
    const [_downloadingBook, setDownloadingBook] = useState<string | null>(null)
    const [isShareTarget, setIsShareTarget] = useState(
        window.location.pathname === '/share-target'
    )

    // Initialize app
    useEffect(() => {
        const init = async () => {
            await loadUsers()
            setIsInitialized(true)
        }
        init()
    }, [loadUsers])

    // Apply theme from preferences
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', preferences.theme)
    }, [preferences.theme])

    // Listen for service worker update events
    useEffect(() => {
        const handleSWUpdate = () => setShowUpdateToast(true)
        window.addEventListener('sw-update-available', handleSWUpdate)
        return () => window.removeEventListener('sw-update-available', handleSWUpdate)
    }, [])

    const handleSWUpdate = () => {
        const doUpdate = (window as any).__codex_updateSW
        if (doUpdate) doUpdate()
    }

    const handleOpenBook = async (book: Book) => {
        const userId = auth.currentUser?.uid || currentUser?.id || 'default-user'

        // Cloud-only book: download file first
        if (!book.fileBlob && book.storageUrl) {
            try {
                setDownloadingBook(book.id)
                const blob = await downloadBookFile(book.storageUrl)
                const updatedBook = { ...book, fileBlob: blob, isCloudOnly: false }

                // Cache in IndexedDB for offline access
                await updateBook(book.id, { fileBlob: blob, isCloudOnly: false })

                await openBook(updatedBook, userId)
            } catch (err) {
                console.error('Failed to download cloud book:', err)
                alert(`Could not download "${book.title}". Check your connection and try again.`)
            } finally {
                setDownloadingBook(null)
            }
            return
        }

        await openBook(book, userId)
    }

    const handleCloseBook = () => {
        closeBook()
    }

    const handleAuthenticated = async () => {
        setIsAuthenticated(true)
        try {
            await syncOnLogin()
        } catch (err) {
            console.error('Sync on login failed:', err)
        }
    }

    const handleLogout = () => {
        syncOnLogout()
        setIsAuthenticated(false)
    }

    const loadingFallback = (
        <div className="app-loading">
            <div className="app-loading-spinner" />
        </div>
    )

    if (!isInitialized) {
        return loadingFallback
    }

    if (!isAuthenticated) {
        return (
            <Suspense fallback={loadingFallback}>
                <LoginScreen onAuthenticated={handleAuthenticated} />
            </Suspense>
        )
    }

    if (isReading && currentBook) {
        if (currentBook.format === 'epub') {
            return (
                <ErrorBoundary fallbackTitle="Reader Error">
                    <Suspense fallback={loadingFallback}>
                        <EpubReader
                            book={currentBook}
                            onClose={handleCloseBook}
                        />
                    </Suspense>
                </ErrorBoundary>
            )
        }

        if (currentBook.format === 'pdf') {
            return (
                <ErrorBoundary fallbackTitle="Reader Error">
                    <Suspense fallback={loadingFallback}>
                        <PdfReader
                            book={currentBook}
                            onClose={handleCloseBook}
                        />
                    </Suspense>
                </ErrorBoundary>
            )
        }

        return (
            <div className="app-reader-placeholder">
                <p>Reader for {currentBook.format.toUpperCase()} format</p>
                <p>Coming soon!</p>
                <p>Book: {currentBook.title}</p>
                <button onClick={handleCloseBook}>
                    Back to Library
                </button>
            </div>
        )
    }

    // Handle share target route
    if (isShareTarget && isAuthenticated) {
        return (
            <Suspense fallback={loadingFallback}>
                <ShareTarget onComplete={() => {
                    setIsShareTarget(false)
                    window.history.replaceState(null, '', '/')
                }} />
            </Suspense>
        )
    }

    return (
        <ErrorBoundary>
            <div className="app">
                <LibraryView onOpenBook={handleOpenBook} onLogout={handleLogout} />
            </div>
            {showUpdateToast && (
                <UpdateToast onUpdate={handleSWUpdate} />
            )}
        </ErrorBoundary>
    )
}

export default App
