import { useEffect } from 'react'
import { useUserStore } from '@/stores/userStore'
import { useReaderStore } from '@/stores/readerStore'
import { LibraryView } from '@/components/library/LibraryView'
import { EpubReader } from '@/components/reader/EpubReader'
import { PdfReader } from '@/components/reader/PdfReader'
import type { Book } from '@/types'
import './App.css'

function App() {
    const { loadUsers, currentUser } = useUserStore()
    const { isReading, currentBook, openBook, closeBook, preferences } = useReaderStore()

    // Initialize app
    useEffect(() => {
        loadUsers()
    }, [loadUsers])

    // Apply theme from preferences
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', preferences.theme)
    }, [preferences.theme])

    const handleOpenBook = async (book: Book) => {
        const userId = currentUser?.id || 'default-user'
        await openBook(book, userId)
    }

    const handleCloseBook = () => {
        closeBook()
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
            <LibraryView onOpenBook={handleOpenBook} />
        </div>
    )
}

export default App
