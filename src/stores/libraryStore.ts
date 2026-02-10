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
    _filteredBooksCache: Book[] | null
    _filteredBooksCacheKey: string | null

    // Actions
    loadBooks: (userId: string) => Promise<void>
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

function computeFilteredBooks(
    books: Book[],
    searchQuery: string,
    sortBy: string,
    sortOrder: string,
    selectedCollection: string | null
): Book[] {
    let filtered = books

    if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(book =>
            book.title.toLowerCase().includes(query) ||
            book.author.toLowerCase().includes(query)
        )
    }

    if (selectedCollection) {
        filtered = filtered.filter(book =>
            book.collectionIds?.includes(selectedCollection)
        )
    }

    const sorted = [...filtered].sort((a, b) => {
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
            case 'lastReadAt': {
                const aTime = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0
                const bTime = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0
                comparison = aTime - bTime
                break
            }
        }

        return sortOrder === 'asc' ? comparison : -comparison
    })

    return sorted
}

function buildCacheKey(
    booksLength: number,
    searchQuery: string,
    sortBy: string,
    sortOrder: string,
    selectedCollection: string | null
): string {
    return `${booksLength}|${searchQuery}|${sortBy}|${sortOrder}|${selectedCollection ?? ''}`
}

export const useLibraryStore = create<LibraryState>()(
    persist(
        (set, get) => ({
            books: [],
            isLoading: false,
            error: null,
            searchQuery: '',
            sortBy: 'addedAt',
            sortOrder: 'desc',
            viewMode: 'grid',
            selectedCollection: null,
            _filteredBooksCache: null,
            _filteredBooksCacheKey: null,

            loadBooks: async (userId: string) => {
                set({ isLoading: true, error: null })
                try {
                    const books = await getAllBooks(userId)
                    set({ books, isLoading: false, _filteredBooksCache: null, _filteredBooksCacheKey: null })
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to load books',
                        isLoading: false
                    })
                }
            },

            addNewBook: async (book: Book) => {
                set({ isLoading: true, error: null })
                try {
                    await addBook(book)
                    set(state => ({
                        books: [book, ...state.books],
                        isLoading: false,
                        _filteredBooksCache: null,
                        _filteredBooksCacheKey: null
                    }))
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to add book',
                        isLoading: false
                    })
                    throw error
                }
            },

            removeBook: async (id: string) => {
                set({ isLoading: true, error: null })
                try {
                    await deleteBook(id)
                    set(state => ({
                        books: state.books.filter(b => b.id !== id),
                        isLoading: false,
                        _filteredBooksCache: null,
                        _filteredBooksCacheKey: null
                    }))
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to remove book',
                        isLoading: false
                    })
                    throw error
                }
            },

            updateBookData: async (id: string, updates: Partial<Book>) => {
                try {
                    await updateBook(id, updates)
                    set(state => ({
                        books: state.books.map(b =>
                            b.id === id ? { ...b, ...updates } : b
                        ),
                        _filteredBooksCache: null,
                        _filteredBooksCacheKey: null
                    }))
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to update book'
                    })
                    throw error
                }
            },

            setSearchQuery: (query: string) => set({ searchQuery: query, _filteredBooksCache: null, _filteredBooksCacheKey: null }),
            setSortBy: (sort) => set({ sortBy: sort, _filteredBooksCache: null, _filteredBooksCacheKey: null }),
            setSortOrder: (order) => set({ sortOrder: order, _filteredBooksCache: null, _filteredBooksCacheKey: null }),
            setViewMode: (mode) => set({ viewMode: mode }),
            setSelectedCollection: (id) => set({ selectedCollection: id, _filteredBooksCache: null, _filteredBooksCacheKey: null }),

            getFilteredBooks: () => {
                const { books, searchQuery, sortBy, sortOrder, selectedCollection, _filteredBooksCache, _filteredBooksCacheKey } = get()

                const key = buildCacheKey(books.length, searchQuery, sortBy, sortOrder, selectedCollection)

                if (_filteredBooksCache && _filteredBooksCacheKey === key) {
                    return _filteredBooksCache
                }

                const result = computeFilteredBooks(books, searchQuery, sortBy, sortOrder, selectedCollection)

                set({ _filteredBooksCache: result, _filteredBooksCacheKey: key })
                return result
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
