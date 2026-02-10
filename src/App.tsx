import { useEffect, useState, lazy, Suspense } from 'react'
import { useUserStore } from '@/stores/userStore'
import { useReaderStore } from '@/stores/readerStore'
import { LibraryView } from '@/components/library/LibraryView'
import { syncOnLogin, syncOnLogout } from '@/services/sync/syncService'
import { auth } from '@/services/firebase'
import type { Book } from '@/types'
import './App.css'

// Lazy-load heavy components — epub.js & pdfjs only download when needed
const EpubReader = lazy(() => import('@/components/reader/EpubReader'))
const PdfReader = lazy(() => import('@/components/reader/PdfReader'))
const LoginScreen = lazy(() => import('@/components/auth/LoginScreen'))

function App() {
    const { loadUsers, currentUser } = useUserStore()
    const { isReading, currentBook, openBook, closeBook, preferences } = useReaderStore()
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)

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

    const handleOpenBook = async (book: Book) => {
        const userId = auth.currentUser?.uid || currentUser?.id || 'default-user'
        await openBook(book, userId)
    }

    const handleCloseBook = () => {
        closeBook()
    }

    const handleAuthenticated = async () => {
        setIsAuthenticated(true)
        // Trigger cloud sync on login
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

    // Wait for initialization
    const loadingFallback = (
        <div className="app-loading">
            <div className="app-loading-spinner" />
        </div>
    )

    if (!isInitialized) {
        return loadingFallback
    }

    // Show login screen if not authenticated
    if (!isAuthenticated) {
        return (
            <Suspense fallback={loadingFallback}>
                <LoginScreen onAuthenticated={handleAuthenticated} />
            </Suspense>
        )
    }

    // Show reader if a book is open
    if (isReading && currentBook) {
        // EPUB Reader
        if (currentBook.format === 'epub') {
            return (
                <Suspense fallback={loadingFallback}>
                    <EpubReader
                        book={currentBook}
                        onClose={handleCloseBook}
                    />
                </Suspense>
            )
        }

        // PDF Reader
        if (currentBook.format === 'pdf') {
            return (
                <Suspense fallback={loadingFallback}>
                    <PdfReader
                        book={currentBook}
                        onClose={handleCloseBook}
                    />
                </Suspense>
            )
        }

        // Placeholder for other formats (TXT, MOBI)
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

    return (
        <div className="app">
            <LibraryView onOpenBook={handleOpenBook} onLogout={handleLogout} />
        </div>
    )
}

export default App

