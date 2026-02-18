import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Book, ReaderPreferences, TocItem, SearchResult, Annotation } from '@/types'
import { saveProgress, getProgress, getAnnotations } from '@/services/storage/db'
import { debouncedSync } from '@/services/sync/syncService'

interface ReaderState {
    // Current book state
    isReading: boolean
    currentBook: Book | null
    currentLocation: string
    percentage: number
    chapterTitle: string

    // UI state
    showToolbar: boolean
    showSettings: boolean
    showToc: boolean
    showSearch: boolean
    showBookmarks: boolean
    showAnnotationMenu: boolean
    annotationMenuPosition: { x: number; y: number } | null

    // Table of contents
    toc: TocItem[]

    // Search
    searchQuery: string
    searchResults: SearchResult[]
    currentSearchIndex: number

    // Annotations for current book
    annotations: Annotation[]
    selectedText: string
    selectionCfi: string

    // Reader preferences
    preferences: ReaderPreferences

    // Actions
    openBook: (book: Book, userId: string) => Promise<void>
    closeBook: () => void
    setLocation: (location: string, percentage: number, chapterTitle?: string) => void
    saveCurrentProgress: (userId: string) => Promise<void>

    toggleToolbar: () => void
    toggleSettings: () => void
    toggleToc: () => void
    toggleSearch: () => void
    toggleBookmarks: () => void
    showAnnotationMenuAt: (text: string, cfi: string, position?: { x: number; y: number }) => void
    hideAnnotationMenu: () => void

    setToc: (toc: TocItem[]) => void

    setSearchQuery: (query: string) => void
    setSearchResults: (results: SearchResult[]) => void
    nextSearchResult: () => void
    prevSearchResult: () => void

    loadAnnotations: (bookId: string, userId: string) => Promise<void>
    addAnnotationToState: (annotation: Annotation) => void
    removeAnnotationFromState: (id: string) => void

    updatePreference: <K extends keyof ReaderPreferences>(
        key: K,
        value: ReaderPreferences[K]
    ) => void
    setPreferences: (preferences: Partial<ReaderPreferences>) => void
}

const defaultPreferences: ReaderPreferences = {
    theme: 'light',
    readingMode: 'paginated',
    fontFamily: 'Literata',
    fontSize: 18,
    lineHeight: 1.6,
    margins: 40,
    textAlign: 'left',
    brightness: 100,
    autoSavePosition: true
}

export const useReaderStore = create<ReaderState>()(
    persist(
        (set, get) => ({
            // Initial state
            isReading: false,
            currentBook: null,
            currentLocation: '',
            percentage: 0,
            chapterTitle: '',

            showToolbar: false,
            showSettings: false,
            showToc: false,
            showSearch: false,
            showBookmarks: false,
            showAnnotationMenu: false,
            annotationMenuPosition: null,

            toc: [],

            searchQuery: '',
            searchResults: [],
            currentSearchIndex: 0,

            annotations: [],
            selectedText: '',
            selectionCfi: '',

            preferences: defaultPreferences,

            // Open a book for reading
            openBook: async (book: Book, userId: string) => {
                // Load saved progress
                const progress = await getProgress(book.id, userId)

                set({
                    isReading: true,
                    currentBook: book,
                    currentLocation: progress?.location || '',
                    percentage: progress?.percentage || 0,
                    chapterTitle: progress?.chapterTitle || '',
                    showToolbar: true, // Show toolbar initially so user sees controls
                    showSettings: false,
                    showToc: false,
                    showSearch: false,
                    annotations: []
                })

                // Load annotations
                await get().loadAnnotations(book.id, userId)
            },

            // Close current book
            closeBook: () => {
                set({
                    isReading: false,
                    currentBook: null,
                    currentLocation: '',
                    percentage: 0,
                    chapterTitle: '',
                    toc: [],
                    searchQuery: '',
                    searchResults: [],
                    annotations: []
                })
            },

            // Update current reading location
            setLocation: (location: string, percentage: number, chapterTitle?: string) => {
                set({
                    currentLocation: location,
                    percentage,
                    ...(chapterTitle !== undefined && { chapterTitle })
                })
            },

            // Save progress to database
            saveCurrentProgress: async (userId: string) => {
                const { currentBook, currentLocation, percentage, chapterTitle } = get()
                if (!currentBook) return

                await saveProgress({
                    bookId: currentBook.id,
                    userId,
                    location: currentLocation,
                    percentage,
                    chapterTitle,
                    lastUpdated: new Date()
                })

                // Keep cloud state fresh without spamming writes on every small movement
                debouncedSync()
            },

            // UI toggles
            toggleToolbar: () => set(state => ({
                showToolbar: !state.showToolbar,
                showSettings: false,
                showToc: false,
                showSearch: false
            })),

            toggleSettings: () => set(state => ({
                showSettings: !state.showSettings,
                showToc: false,
                showSearch: false,
                showBookmarks: false
            })),

            toggleToc: () => set(state => ({
                showToc: !state.showToc,
                showSettings: false,
                showSearch: false,
                showBookmarks: false
            })),

            toggleSearch: () => set(state => ({
                showSearch: !state.showSearch,
                showSettings: false,
                showToc: false,
                showBookmarks: false
            })),

            toggleBookmarks: () => set(state => ({
                showBookmarks: !state.showBookmarks,
                showSettings: false,
                showToc: false,
                showSearch: false
            })),

            showAnnotationMenuAt: (text: string, cfi: string, position?: { x: number; y: number }) => set({
                showAnnotationMenu: true,
                selectedText: text,
                selectionCfi: cfi,
                annotationMenuPosition: position || null
            }),

            hideAnnotationMenu: () => set({
                showAnnotationMenu: false,
                selectedText: '',
                selectionCfi: '',
                annotationMenuPosition: null
            }),

            // Set table of contents
            setToc: (toc: TocItem[]) => set({ toc }),

            // Search
            setSearchQuery: (query: string) => set({
                searchQuery: query,
                currentSearchIndex: 0
            }),

            setSearchResults: (results: SearchResult[]) => set({
                searchResults: results,
                currentSearchIndex: 0
            }),

            nextSearchResult: () => set(state => ({
                currentSearchIndex: Math.min(
                    state.currentSearchIndex + 1,
                    state.searchResults.length - 1
                )
            })),

            prevSearchResult: () => set(state => ({
                currentSearchIndex: Math.max(state.currentSearchIndex - 1, 0)
            })),

            // Annotations
            loadAnnotations: async (bookId: string, userId: string) => {
                const annotations = await getAnnotations(bookId, userId)
                set({ annotations })
            },

            addAnnotationToState: (annotation: Annotation) => set(state => ({
                annotations: [...state.annotations, annotation]
            })),

            removeAnnotationFromState: (id: string) => set(state => ({
                annotations: state.annotations.filter(a => a.id !== id)
            })),

            // Preferences
            updatePreference: (key, value) => set(state => ({
                preferences: { ...state.preferences, [key]: value }
            })),

            setPreferences: (newPrefs) => set(state => ({
                preferences: { ...state.preferences, ...newPrefs }
            }))
        }),
        {
            name: 'pageturner-reader',
            partialize: (state) => ({
                preferences: state.preferences
            })
        }
    )
)
