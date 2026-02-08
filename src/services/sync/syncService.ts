/**
 * Cloud Sync Service
 * Bidirectional synchronization between IndexedDB and Firebase Firestore
 */

import { auth, db as firestore } from '@/services/firebase'
import { db } from '@/services/storage/db'
import { useSyncStore } from '@/stores/syncStore'
import {
    collection,
    doc,
    getDocs,
    setDoc,
    serverTimestamp,
    onSnapshot,
    type Unsubscribe
} from 'firebase/firestore'
import type { Annotation, Collection, ReadingProgress, Book } from '@/types'

// Debounce timer for sync operations
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SYNC_DEBOUNCE_MS = 2000

// Real-time listeners
let annotationsUnsubscribe: Unsubscribe | null = null
let collectionsUnsubscribe: Unsubscribe | null = null
let progressUnsubscribe: Unsubscribe | null = null

/**
 * Sync all data types to/from Firestore
 */
export async function syncAll(): Promise<void> {
    const userId = auth.currentUser?.uid
    if (!userId) {
        console.log('Sync skipped: No authenticated user')
        return
    }

    const { isSyncing, setSyncing, setLastSyncTime, addSyncError, isOnline } = useSyncStore.getState()

    if (!isOnline) {
        console.log('Sync skipped: Offline')
        return
    }

    if (isSyncing) {
        console.log('Sync skipped: Already syncing')
        return
    }

    setSyncing(true)

    try {
        await Promise.all([
            syncAnnotations(userId),
            syncCollections(userId),
            syncProgress(userId),
            syncBookMetadata(userId)
        ])

        setLastSyncTime(new Date())
        console.log('Sync completed successfully')
    } catch (error) {
        console.error('Sync failed:', error)
        addSyncError(error instanceof Error ? error.message : 'Unknown sync error')
    } finally {
        setSyncing(false)
    }
}

/**
 * Debounced sync - prevents rapid successive syncs
 */
export function debouncedSync(): void {
    if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer)
    }

    syncDebounceTimer = setTimeout(() => {
        syncAll()
    }, SYNC_DEBOUNCE_MS)
}

/**
 * Sync annotations (highlights, bookmarks, notes)
 */
async function syncAnnotations(userId: string): Promise<void> {
    // Get local annotations
    const localAnnotations = await db.annotations.toArray()

    // Get cloud annotations
    const annoCol = collection(firestore, 'users', userId, 'annotations')
    const cloudSnap = await getDocs(annoCol)
    const cloudAnnotations = new Map<string, Annotation & { updatedAt?: Date }>()

    cloudSnap.forEach(doc => {
        const data = doc.data()
        cloudAnnotations.set(doc.id, {
            ...data,
            id: doc.id
        } as Annotation)
    })

    // Push local to cloud (if not exists or newer)
    for (const local of localAnnotations) {
        const cloud = cloudAnnotations.get(local.id)

        if (!cloud || isNewer(local.updatedAt, cloud.updatedAt)) {
            await setDoc(doc(firestore, 'users', userId, 'annotations', local.id), {
                id: local.id,
                bookId: local.bookId,
                type: local.type,
                cfiRange: local.cfiRange || null,
                text: local.text || '',
                note: local.note || null,
                color: local.color || 'yellow',
                label: local.label || null,
                createdAt: local.createdAt,
                updatedAt: serverTimestamp()
            })
        }
    }

    // Pull cloud to local (if not exists locally)
    for (const [id, cloud] of cloudAnnotations) {
        const localExists = localAnnotations.some(a => a.id === id)

        if (!localExists) {
            await db.annotations.add({
                ...cloud,
                createdAt: cloud.createdAt instanceof Date ? cloud.createdAt : new Date(),
                updatedAt: new Date()
            } as Annotation)
        }
    }
}

/**
 * Sync collections
 */
async function syncCollections(userId: string): Promise<void> {
    const localCollections = await db.collections.toArray()

    const colCol = collection(firestore, 'users', userId, 'collections')
    const cloudSnap = await getDocs(colCol)
    const cloudCollections = new Map<string, Collection>()

    cloudSnap.forEach(doc => {
        cloudCollections.set(doc.id, { ...doc.data(), id: doc.id } as Collection)
    })

    // Push local to cloud
    for (const local of localCollections) {
        if (!cloudCollections.has(local.id)) {
            await setDoc(doc(firestore, 'users', userId, 'collections', local.id), {
                id: local.id,
                name: local.name,
                color: local.color,
                createdAt: serverTimestamp()
            })
        }
    }

    // Pull cloud to local
    for (const [id, cloud] of cloudCollections) {
        const localExists = localCollections.some(c => c.id === id)

        if (!localExists) {
            await db.collections.add({
                ...cloud,
                createdAt: cloud.createdAt instanceof Date ? cloud.createdAt : new Date()
            } as Collection)
        }
    }
}

/**
 * Sync reading progress
 */
async function syncProgress(userId: string): Promise<void> {
    const localProgress = await db.progress.toArray()

    const progCol = collection(firestore, 'users', userId, 'progress')
    const cloudSnap = await getDocs(progCol)
    const cloudProgress = new Map<string, ReadingProgress & { id?: number }>()

    cloudSnap.forEach(doc => {
        cloudProgress.set(doc.id, doc.data() as ReadingProgress)
    })

    // Push local to cloud (higher percentage wins)
    for (const local of localProgress) {
        const cloud = cloudProgress.get(local.bookId)

        if (!cloud || local.percentage > (cloud.percentage || 0)) {
            await setDoc(doc(firestore, 'users', userId, 'progress', local.bookId), {
                bookId: local.bookId,
                userId: local.userId,
                location: local.location,
                percentage: local.percentage,
                chapterTitle: local.chapterTitle || null,
                lastUpdated: serverTimestamp()
            })
        }
    }

    // Pull cloud to local (if higher percentage)
    for (const [bookId, cloud] of cloudProgress) {
        const local = localProgress.find(p => p.bookId === bookId)

        if (!local || (cloud.percentage || 0) > local.percentage) {
            await db.progress.put({
                bookId: cloud.bookId,
                userId: cloud.userId,
                location: cloud.location,
                percentage: cloud.percentage,
                chapterTitle: cloud.chapterTitle,
                lastUpdated: new Date()
            } as ReadingProgress & { id: number })
        }
    }
}

/**
 * Sync book metadata (NOT file blobs)
 */
async function syncBookMetadata(userId: string): Promise<void> {
    const localBooks = await db.books.toArray()

    const booksCol = collection(firestore, 'users', userId, 'books')
    const cloudSnap = await getDocs(booksCol)
    const cloudBooks = new Map<string, Partial<Book>>()

    cloudSnap.forEach(doc => {
        cloudBooks.set(doc.id, doc.data() as Partial<Book>)
    })

    // Push local book metadata to cloud (only metadata, not file)
    for (const local of localBooks) {
        if (!cloudBooks.has(local.id)) {
            await setDoc(doc(firestore, 'users', userId, 'books', local.id), {
                id: local.id,
                title: local.title,
                author: local.author,
                format: local.format,
                addedAt: local.addedAt,
                lastReadAt: local.lastReadAt || null,
                collectionIds: local.collectionIds || [],
                coverUrl: local.coverUrl || null
                // Note: fileBlob is NOT synced (too large)
            })
        }
    }
}

/**
 * Start real-time sync listeners
 */
export function startRealtimeSync(): void {
    const userId = auth.currentUser?.uid
    if (!userId) return

    // Listen for annotation changes
    const annoCol = collection(firestore, 'users', userId, 'annotations')
    annotationsUnsubscribe = onSnapshot(annoCol, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data() as Annotation
                const exists = await db.annotations.get(data.id)
                if (!exists) {
                    await db.annotations.add({
                        ...data,
                        createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
                        updatedAt: new Date()
                    })
                }
            } else if (change.type === 'removed') {
                await db.annotations.delete(change.doc.id)
            }
        }
    })

    console.log('Real-time sync started')
}

/**
 * Stop real-time sync listeners
 */
export function stopRealtimeSync(): void {
    annotationsUnsubscribe?.()
    collectionsUnsubscribe?.()
    progressUnsubscribe?.()

    annotationsUnsubscribe = null
    collectionsUnsubscribe = null
    progressUnsubscribe = null

    console.log('Real-time sync stopped')
}

/**
 * Sync on login - initial sync when user authenticates
 */
export async function syncOnLogin(): Promise<void> {
    await syncAll()
    startRealtimeSync()
}

/**
 * Sync on logout - stop listeners
 */
export function syncOnLogout(): void {
    stopRealtimeSync()
}

/**
 * Helper: Check if date A is newer than date B
 */
function isNewer(a?: Date, b?: Date): boolean {
    if (!a) return false
    if (!b) return true
    return new Date(a).getTime() > new Date(b).getTime()
}
