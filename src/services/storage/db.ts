import Dexie, { type EntityTable } from 'dexie'
import type { Book, ReadingProgress, Annotation, UserProfile, Collection, ReadingSession } from '@/types'
import {
    syncAnnotation as firebaseSyncAnnotation,
    deleteAnnotation as firebaseDeleteAnnotation,
    deleteBookMetadata as firebaseDeleteBookMetadata,
    auth
} from '@/services/firebase'
import { deleteBookFiles } from '@/services/storage/storageService'
import { useSyncStore } from '@/stores/syncStore'

/**
 * PageTurner Database Schema
 * Using Dexie.js for IndexedDB wrapper
 */

// Extend types for Dexie (with auto-increment id where needed)
interface DbReadingProgress extends ReadingProgress {
    id: number
}

interface DbReadingSession extends ReadingSession {
    id: number
}

class PageTurnerDatabase extends Dexie {
    books!: EntityTable<Book, 'id'>
    progress!: EntityTable<DbReadingProgress, 'id'>
    annotations!: EntityTable<Annotation, 'id'>
    users!: EntityTable<UserProfile, 'id'>
    collections!: EntityTable<Collection, 'id'>
    sessions!: EntityTable<DbReadingSession, 'id'>

    constructor() {
        super('PageTurnerDB')

        this.version(1).stores({
            // Primary key and indexed fields
            books: 'id, title, author, format, addedAt, lastReadAt, *collectionIds',
            progress: '++id, [bookId+userId], bookId, userId, lastUpdated',
            annotations: 'id, bookId, userId, type, createdAt, [bookId+userId]',
            users: 'id, name, createdAt',
            collections: 'id, name, createdAt',
            sessions: '++id, bookId, userId, startTime, [bookId+userId]'
        })

        // User-scoped indexes for multi-account isolation on shared devices
        this.version(2).stores({
            books: 'id, userId, title, author, format, addedAt, lastReadAt, *collectionIds, [userId+addedAt]',
            progress: '++id, [bookId+userId], bookId, userId, lastUpdated',
            annotations: 'id, bookId, userId, type, createdAt, [bookId+userId]',
            users: 'id, name, createdAt',
            collections: 'id, userId, name, createdAt, [userId+name]',
            sessions: '++id, bookId, userId, startTime, [bookId+userId]'
        })
    }
}

export const db = new PageTurnerDatabase()

// ============================================
// Book Operations
// ============================================

export async function addBook(book: Book): Promise<string> {
    await db.books.add(book)
    useSyncStore.getState().markDirty('bookMetadata')
    return book.id
}

export async function getBook(id: string): Promise<Book | undefined> {
    return db.books.get(id)
}

export async function getAllBooks(userId: string): Promise<Book[]> {
    let books = await db.books
        .where('userId')
        .equals(userId)
        .toArray()

    if (books.length === 0) {
        const legacyBooks = await db.books.filter(book => !book.userId).toArray()
        if (legacyBooks.length > 0) {
            await Promise.all(legacyBooks.map(book => db.books.update(book.id, { userId })))
            books = await db.books.where('userId').equals(userId).toArray()
        }
    }

    return books.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<void> {
    await db.books.update(id, updates)
    useSyncStore.getState().markDirty('bookMetadata')
}

interface DeleteBookOptions {
    storageUserId?: string
    cleanupStorage?: boolean
}

export async function deleteBook(id: string, options?: DeleteBookOptions): Promise<void> {
    const { storageUserId, cleanupStorage = false } = options || {}

    if (cleanupStorage && storageUserId) {
        try {
            await deleteBookFiles(storageUserId, id)
        } catch (err) {
            console.warn(`Failed to delete storage files for book ${id}:`, err)
        }
    }

    await db.transaction('rw', [db.books, db.progress, db.annotations], async () => {
        await db.books.delete(id)
        await db.progress.where('bookId').equals(id).delete()
        await db.annotations.where('bookId').equals(id).delete()
    })

    useSyncStore.getState().markDirty('bookMetadata')

    if (storageUserId) {
        try {
            await firebaseDeleteBookMetadata(storageUserId, id)
        } catch (err) {
            console.warn(`Failed to delete cloud metadata for book ${id}:`, err)
        }
    }
}

export async function getBooksByCollection(collectionId: string, userId: string): Promise<Book[]> {
    return db.books
        .where('collectionIds')
        .equals(collectionId)
        .filter(book => book.userId === userId)
        .toArray()
}

// ============================================
// Reading Progress Operations
// ============================================

export async function saveProgress(progress: Omit<ReadingProgress, 'id'>): Promise<void> {
    const existing = await db.progress
        .where('[bookId+userId]')
        .equals([progress.bookId, progress.userId])
        .first()

    if (existing) {
        await db.progress.update(existing.id, {
            ...progress,
            lastUpdated: new Date()
        })
    } else {
        await db.progress.add({
            ...progress,
            lastUpdated: new Date()
        } as DbReadingProgress)
    }

    // Also update lastReadAt on the book
    await db.books.update(progress.bookId, {
        lastReadAt: new Date()
    })
}

export async function getProgress(bookId: string, userId: string): Promise<ReadingProgress | undefined> {
    return db.progress
        .where('[bookId+userId]')
        .equals([bookId, userId])
        .first()
}

export async function getProgressForBooks(
    userId: string,
    bookIds: string[]
): Promise<Record<string, ReadingProgress>> {
    if (!userId || bookIds.length === 0) {
        return {}
    }

    const targetBookIds = new Set(bookIds)
    const userProgress = await db.progress.where('userId').equals(userId).toArray()
    const progressMap: Record<string, ReadingProgress> = {}

    for (const item of userProgress) {
        if (!targetBookIds.has(item.bookId)) continue

        const existing = progressMap[item.bookId]
        if (!existing || new Date(item.lastUpdated).getTime() > new Date(existing.lastUpdated).getTime()) {
            progressMap[item.bookId] = item
        }
    }

    return progressMap
}

export async function getRecentlyRead(userId: string, limit = 10): Promise<Book[]> {
    const progressList = await db.progress
        .where('userId')
        .equals(userId)
        .reverse()
        .sortBy('lastUpdated')

    const bookIds = progressList.slice(0, limit).map(p => p.bookId)
    const books = await db.books.bulkGet(bookIds)
    return books.filter((b): b is Book => b !== undefined)
}

// ============================================
// Annotation Operations
// ============================================

export async function addAnnotation(annotation: Annotation): Promise<void> {
    await db.annotations.add(annotation)

    // Sync to Firebase if user is authenticated
    const userId = auth.currentUser?.uid
    if (userId) {
        try {
            await firebaseSyncAnnotation(userId, {
                id: annotation.id,
                bookId: annotation.bookId,
                type: annotation.type,
                cfiRange: annotation.cfiRange,
                text: annotation.text || '',
                note: annotation.note || null,
                color: annotation.color || 'yellow',
                label: annotation.label || null
            })
        } catch (err) {
            console.error('Firebase sync failed for annotation:', err)
            useSyncStore.getState().markDirty('annotations')
        }
    }
}

export async function getAnnotations(bookId: string, userId: string): Promise<Annotation[]> {
    return db.annotations
        .where('[bookId+userId]')
        .equals([bookId, userId])
        .toArray()
}

export async function getAnnotationsByType(
    bookId: string,
    userId: string,
    type: Annotation['type']
): Promise<Annotation[]> {
    return db.annotations
        .where('[bookId+userId]')
        .equals([bookId, userId])
        .filter(a => a.type === type)
        .toArray()
}

export async function updateAnnotation(id: string, updates: Partial<Annotation>): Promise<void> {
    await db.annotations.update(id, {
        ...updates,
        updatedAt: new Date()
    })
}

export async function deleteAnnotation(id: string): Promise<void> {
    await db.annotations.delete(id)

    // Delete from Firebase if user is authenticated
    const userId = auth.currentUser?.uid
    if (userId) {
        try {
            await firebaseDeleteAnnotation(userId, id)
        } catch (err) {
            console.error('Firebase delete failed for annotation:', err)
            useSyncStore.getState().markDirty('annotations')
        }
    }
}

/**
 * Upsert an auto-save bookmark (insert or update by ID)
 * Used for auto-saving reading position - always overwrites previous
 */
export async function upsertAutoSaveBookmark(annotation: Annotation): Promise<void> {
    // Use put() for atomic upsert - avoids race condition between get() and add()
    await db.annotations.put({
        ...annotation,
        updatedAt: new Date()
    })
}

/**
 * Get the auto-save bookmark for a specific book
 */
export async function getAutoSaveBookmark(bookId: string, userId: string): Promise<Annotation | undefined> {
    const autoSaveId = `autosave-${userId}-${bookId}`
    return db.annotations.get(autoSaveId)
}

// ============================================
// User Profile Operations
// ============================================

export async function createUser(user: UserProfile): Promise<void> {
    await db.users.add(user)
}

export async function getUser(id: string): Promise<UserProfile | undefined> {
    return db.users.get(id)
}

export async function getAllUsers(): Promise<UserProfile[]> {
    return db.users.toArray()
}

export async function updateUserPreferences(
    userId: string,
    preferences: Partial<UserProfile['preferences']>
): Promise<void> {
    const user = await db.users.get(userId)
    if (user) {
        await db.users.update(userId, {
            preferences: { ...user.preferences, ...preferences }
        })
    }
}

export async function deleteUser(id: string): Promise<void> {
    await db.transaction('rw', [db.users, db.progress, db.annotations], async () => {
        await db.users.delete(id)
        await db.progress.where('userId').equals(id).delete()
        await db.annotations.where('userId').equals(id).delete()
    })
}

// ============================================
// Collection Operations
// ============================================

export async function createCollection(collection: Collection): Promise<void> {
    const trimmedName = collection.name.trim()
    const normalizedName = trimmedName.toLowerCase()
    const userId = collection.userId

    if (!trimmedName) {
        throw new Error('Collection name is required')
    }

    await db.transaction('rw', db.collections, async () => {
        let existing: Collection | undefined

        if (userId) {
            existing = await db.collections
                .where('userId')
                .equals(userId)
                .filter(col => col.name.trim().toLowerCase() === normalizedName)
                .first()
        } else {
            existing = await db.collections
                .filter(col => !col.userId && col.name.trim().toLowerCase() === normalizedName)
                .first()
        }

        if (existing) {
            throw new Error('Collection already exists')
        }

        await db.collections.add({
            ...collection,
            name: trimmedName
        })
    })
}

export async function getAllCollections(userId: string): Promise<Collection[]> {
    let collections = await db.collections
        .where('userId')
        .equals(userId)
        .sortBy('name')

    if (collections.length === 0) {
        const legacyCollections = await db.collections.filter(col => !col.userId).toArray()
        if (legacyCollections.length > 0) {
            await Promise.all(legacyCollections.map(col => db.collections.update(col.id, { userId })))
            collections = await db.collections.where('userId').equals(userId).sortBy('name')
        }
    }

    return collections
}

export async function updateCollection(id: string, updates: Partial<Collection>): Promise<void> {
    await db.collections.update(id, updates)
}

export async function deleteCollection(id: string): Promise<void> {
    // Remove collection reference from books
    const books = await db.books.where('collectionIds').equals(id).toArray()
    for (const book of books) {
        const newCollectionIds = book.collectionIds?.filter(cid => cid !== id) || []
        await db.books.update(book.id, { collectionIds: newCollectionIds })
    }
    await db.collections.delete(id)
}

// ============================================
// Reading Session Operations
// ============================================

export async function startSession(bookId: string, userId: string): Promise<number> {
    const id = await db.sessions.add({
        bookId,
        userId,
        startTime: new Date(),
        endTime: new Date(),
        pagesRead: 0,
        duration: 0
    } as DbReadingSession)
    return id
}

export async function endSession(
    sessionId: number,
    pagesRead: number
): Promise<void> {
    const session = await db.sessions.get(sessionId)
    if (session) {
        const endTime = new Date()
        const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000)

        // Ignore ultra-short/no-op sessions (common in dev remounts)
        if (duration < 5 && pagesRead <= 0) {
            await db.sessions.delete(sessionId)
            return
        }

        await db.sessions.update(sessionId, {
            endTime,
            pagesRead,
            duration
        })
    }
}

export async function getReadingStats(userId: string): Promise<{
    totalBooks: number
    totalTime: number
    totalPages: number
}> {
    const sessions = await db.sessions.where('userId').equals(userId).toArray()
    const progress = await db.progress.where('userId').equals(userId).toArray()

    return {
        totalBooks: new Set(progress.map(p => p.bookId)).size,
        totalTime: sessions.reduce((sum, s) => sum + s.duration, 0),
        totalPages: sessions.reduce((sum, s) => sum + s.pagesRead, 0)
    }
}

export async function getReadingStatsDetailed(userId: string): Promise<{
    totalBooks: number
    totalTime: number
    totalPages: number
    sessionsCount: number
    averageSessionTime: number
    weeklyActivity: { day: string; minutes: number }[]
}> {
    const sessions = await db.sessions.where('userId').equals(userId).toArray()
    const progress = await db.progress.where('userId').equals(userId).toArray()

    const totalTime = sessions.reduce((sum, s) => sum + s.duration, 0)
    const sessionsCount = sessions.length
    const totalPages = sessions.reduce((sum, s) => sum + s.pagesRead, 0)
    const averageSessionTime = sessionsCount > 0 ? Math.round(totalTime / sessionsCount) : 0

    const now = new Date()
    const days: { key: string; label: string; minutes: number }[] = []
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(now.getDate() - i)
        const key = date.toISOString().slice(0, 10)
        const label = date.toLocaleDateString(undefined, { weekday: 'short' })
        days.push({ key, label, minutes: 0 })
    }

    const byDay = new Map(days.map(d => [d.key, d]))
    for (const s of sessions) {
        const key = new Date(s.endTime).toISOString().slice(0, 10)
        const day = byDay.get(key)
        if (day) {
            day.minutes += Math.round(s.duration / 60)
        }
    }

    return {
        totalBooks: new Set(progress.map(p => p.bookId)).size,
        totalTime,
        totalPages,
        sessionsCount,
        averageSessionTime,
        weeklyActivity: days.map(d => ({ day: d.label, minutes: d.minutes }))
    }
}

// ============================================
// Utility Functions
// ============================================

export async function clearAllData(): Promise<void> {
    await db.delete()
    await db.open()
}

export async function exportData(): Promise<{
    books: Book[]
    progress: ReadingProgress[]
    annotations: Annotation[]
    users: UserProfile[]
    collections: Collection[]
}> {
    return {
        books: await db.books.toArray(),
        progress: await db.progress.toArray(),
        annotations: await db.annotations.toArray(),
        users: await db.users.toArray(),
        collections: await db.collections.toArray()
    }
}
