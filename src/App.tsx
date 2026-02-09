import { useEffect, useState } from 'react'
import { useUserStore } from '@/stores/userStore'
import { useReaderStore } from '@/stores/readerStore'
import { LibraryView } from '@/components/library/LibraryView'
import { EpubReader } from '@/components/reader/EpubReader'
import { PdfReader } from '@/components/reader/PdfReader'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { syncOnLogin, syncOnLogout } from '@/services/sync/syncService'
import { auth } from '@/services/firebase'
import type { Book } from '@/types'
import './App.css'

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
    if (!isInitialized) {
        return (
            <div className="app-loading">
                <div className="app-loading-spinner" />
            </div>
        )
    }

    // Show login screen if not authenticated
    if (!isAuthenticated) {
        return <LoginScreen onAuthenticated={handleAuthenticated} />
    }

    // Show reader if a book is open
    if (isReading && currentBook) {
        // EPUB Reader
        if (currentBook.format === 'epub') {
            return (
                <EpubReader
                    book={currentBook}
                    onClose={handleCloseBook}
                />
            )
        }

        // PDF Reader
        if (currentBook.format === 'pdf') {
            return (
                <PdfReader
                    book={currentBook}
                    onClose={handleCloseBook}
                />
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

