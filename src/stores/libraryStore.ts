import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Book } from '@/types'
import { getAllBooks, addBook, deleteBook, updateBook } from '@/services/storage/db'

interface LibraryState {
    // State
    books: Book[]
    isLoading: boolean
    error: string | null
    searchQuery: string
    sortBy: 'title' | 'author' | 'addedAt' | 'lastReadAt'
    sortOrder: 'asc' | 'desc'
    viewMode: 'grid' | 'list'
    selectedCollection: string | null

    // Actions
    loadBooks: () => Promise<void>
    addNewBook: (book: Book) => Promise<void>
    removeBook: (id: string) => Promise<void>
    updateBookData: (id: string, updates: Partial<Book>) => Promise<void>
    setSearchQuery: (query: string) => void
    setSortBy: (sort: 'title' | 'author' | 'addedAt' | 'lastReadAt') => void
    setSortOrder: (order: 'asc' | 'desc') => void
    setViewMode: (mode: 'grid' | 'list') => void
    setSelectedCollection: (id: string | null) => void
    getFilteredBooks: () => Book[]
}

export const useLibraryStore = create<LibraryState>()(
    persist(
        (set, get) => ({
            // Initial state
            books: [],
            isLoading: false,
            error: null,
            searchQuery: '',
            sortBy: 'addedAt',
            sortOrder: 'desc',
            viewMode: 'grid',
            selectedCollection: null,

            // Load books from IndexedDB
            loadBooks: async () => {
                set({ isLoading: true, error: null })
                try {
                    const books = await getAllBooks()
                    set({ books, isLoading: false })
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to load books',
                        isLoading: false
                    })
                }
            },

            // Add a new book
            addNewBook: async (book: Book) => {
                set({ isLoading: true, error: null })
                try {
                    await addBook(book)
                    set(state => ({
                        books: [book, ...state.books],
                        isLoading: false
                    }))
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to add book',
                        isLoading: false
                    })
                    throw error
                }
            },

            // Remove a book
            removeBook: async (id: string) => {
                set({ isLoading: true, error: null })
                try {
                    await deleteBook(id)
                    set(state => ({
                        books: state.books.filter(b => b.id !== id),
                        isLoading: false
                    }))
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to remove book',
                        isLoading: false
                    })
                    throw error
                }
            },

            // Update book data
            updateBookData: async (id: string, updates: Partial<Book>) => {
                try {
                    await updateBook(id, updates)
                    set(state => ({
                        books: state.books.map(b =>
                            b.id === id ? { ...b, ...updates } : b
                        )
                    }))
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to update book'
                    })
                    throw error
                }
            },

            // Set search query
            setSearchQuery: (query: string) => set({ searchQuery: query }),

            // Set sort field
            setSortBy: (sort) => set({ sortBy: sort }),

            // Set sort order
            setSortOrder: (order) => set({ sortOrder: order }),

            // Set view mode
            setViewMode: (mode) => set({ viewMode: mode }),

            // Set selected collection
            setSelectedCollection: (id) => set({ selectedCollection: id }),

            // Get filtered and sorted books
            getFilteredBooks: () => {
                const { books, searchQuery, sortBy, sortOrder, selectedCollection } = get()

                let filtered = books

                // Filter by search query
                if (searchQuery) {
                    const query = searchQuery.toLowerCase()
                    filtered = filtered.filter(book =>
                        book.title.toLowerCase().includes(query) ||
                        book.author.toLowerCase().includes(query)
                    )
                }

                // Filter by collection
                if (selectedCollection) {
                    filtered = filtered.filter(book =>
                        book.collectionIds?.includes(selectedCollection)
                    )
                }

                // Sort books
                filtered.sort((a, b) => {
                    let comparison = 0

                    switch (sortBy) {
                        case 'title':
                            comparison = a.title.localeCompare(b.title)
                            break
                        case 'author':
                            comparison = a.author.localeCompare(b.author)
                            break
                        case 'addedAt':
                            comparison = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
                            break
                        case 'lastReadAt':
                            const aTime = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0
                            const bTime = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0
                            comparison = aTime - bTime
                            break
                    }

                    return sortOrder === 'asc' ? comparison : -comparison
                })

                return filtered
            }
        }),
        {
            name: 'pageturner-library',
            partialize: (state) => ({
                sortBy: state.sortBy,
                sortOrder: state.sortOrder,
                viewMode: state.viewMode
            })
        }
    )
)
