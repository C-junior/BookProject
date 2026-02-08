/**
 * PageTurner Type Definitions
 */

// ============================================
// Book Types
// ============================================

export type BookFormat = 'epub' | 'pdf' | 'mobi' | 'txt' | 'html'

export interface BookMetadata {
    title: string
    author: string
    description?: string
    publisher?: string
    publishDate?: string
    language?: string
    isbn?: string
    subjects?: string[]
    pageCount?: number
}

export interface Book {
    id: string
    title: string
    author: string
    format: BookFormat
    coverUrl?: string
    coverBlob?: Blob
    fileBlob?: Blob  // Optional - may not exist for cloud-only books
    fileSize: number
    metadata: BookMetadata
    addedAt: Date
    lastReadAt?: Date
    collectionIds?: string[]
    /** Firebase Storage download URL for book file */
    storageUrl?: string
    /** Firebase Storage download URL for cover image */
    coverStorageUrl?: string
    /** True if book is synced from cloud but file not downloaded locally */
    isCloudOnly?: boolean
}

export interface Collection {
    id: string
    name: string
    color: string
    createdAt: Date
}

// ============================================
// Reading Progress Types
// ============================================

export interface ReadingProgress {
    id?: number
    bookId: string
    userId: string
    /** CFI for EPUB, page number string for PDF */
    location: string
    /** 0-100 percentage */
    percentage: number
    /** Current chapter/section name */
    chapterTitle?: string
    lastUpdated: Date
}

export interface ReadingSession {
    id?: number
    bookId: string
    userId: string
    startTime: Date
    endTime: Date
    pagesRead: number
    duration: number // in seconds
}

// ============================================
// Annotation Types
// ============================================

export type AnnotationType = 'highlight' | 'note' | 'bookmark'

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

export type BookmarkColor = 'gold' | 'teal' | 'coral' | 'lavender' | 'mint' | 'rose' | 'sky' | 'amber'

export interface Annotation {
    id: string
    bookId: string
    userId: string
    type: AnnotationType
    /** CFI range for EPUB */
    cfiRange?: string
    /** Page number for PDF */
    pageNumber?: number
    /** Selected text */
    text: string
    /** User note */
    note?: string
    /** Highlight color or bookmark color */
    color: HighlightColor | BookmarkColor
    /** User-defined label for bookmarks */
    label?: string
    createdAt: Date
    updatedAt: Date
}

// ============================================
// User Types
// ============================================

export interface UserProfile {
    id: string
    name: string
    avatar?: string
    createdAt: Date
    preferences: ReaderPreferences
}

export interface ReaderPreferences {
    theme: 'light' | 'dark' | 'sepia' | 'custom'
    customTheme?: CustomTheme
    fontFamily: string
    fontSize: number // in pixels
    lineHeight: number // multiplier
    margins: number // in pixels
    textAlign: 'left' | 'justify'
    brightness: number // 0-100
    /** Auto-save reading position as bookmark (default: true) */
    autoSavePosition: boolean
    /** Has user completed onboarding tour (default: false) */
    hasCompletedOnboarding?: boolean
}

export interface CustomTheme {
    name: string
    backgroundColor: string
    textColor: string
    accentColor: string
}

// ============================================
// Reader State Types
// ============================================

export interface ReaderState {
    isReading: boolean
    currentBook: Book | null
    currentLocation: string
    showToolbar: boolean
    showSettings: boolean
    showToc: boolean
    showSearch: boolean
    searchQuery: string
    searchResults: SearchResult[]
    isSpeaking: boolean
    speechRate: number
}

export interface SearchResult {
    cfi: string
    excerpt: string
    chapter: string
}

// ============================================
// Table of Contents Types
// ============================================

export interface TocItem {
    id: string
    href: string
    label: string
    level: number
    children?: TocItem[]
}

// ============================================
// Import/Upload Types
// ============================================

export interface ImportResult {
    success: boolean
    book?: Book
    error?: string
}

export interface UploadProgress {
    fileName: string
    progress: number // 0-100
    status: 'pending' | 'processing' | 'complete' | 'error'
    error?: string
}
