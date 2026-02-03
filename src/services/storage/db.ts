import Dexie, { type EntityTable } from 'dexie'
import type { Book, ReadingProgress, Annotation, UserProfile, Collection, ReadingSession } from '@/types'

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
    }
}

export const db = new PageTurnerDatabase()

// ============================================
// Book Operations
// ============================================

export async function addBook(book: Book): Promise<string> {
    await db.books.add(book)
    return book.id
}

export async function getBook(id: string): Promise<Book | undefined> {
    return db.books.get(id)
}

export async function getAllBooks(): Promise<Book[]> {
    return db.books.orderBy('addedAt').reverse().toArray()
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<void> {
    await db.books.update(id, updates)
}

export async function deleteBook(id: string): Promise<void> {
    await db.transaction('rw', [db.books, db.progress, db.annotations], async () => {
        await db.books.delete(id)
        await db.progress.where('bookId').equals(id).delete()
        await db.annotations.where('bookId').equals(id).delete()
    })
}

export async function getBooksByCollection(collectionId: string): Promise<Book[]> {
    return db.books.where('collectionIds').equals(collectionId).toArray()
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
}

/**
 * Upsert an auto-save bookmark (insert or update by ID)
 * Used for auto-saving reading position - always overwrites previous
 */
export async function upsertAutoSaveBookmark(annotation: Annotation): Promise<void> {
    const existing = await db.annotations.get(annotation.id)
    if (existing) {
        await db.annotations.update(annotation.id, {
            ...annotation,
            updatedAt: new Date()
        })
    } else {
        await db.annotations.add(annotation)
    }
}

/**
 * Get the auto-save bookmark for a specific book
 */
export async function getAutoSaveBookmark(bookId: string): Promise<Annotation | undefined> {
    const autoSaveId = `autosave-${bookId}`
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
    await db.collections.add(collection)
}

export async function getAllCollections(): Promise<Collection[]> {
    return db.collections.orderBy('name').toArray()
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
