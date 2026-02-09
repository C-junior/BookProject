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
    Timestamp,
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
    const localAnnotations = await db.annotations.where('userId').equals(userId).toArray()

    // Get cloud annotations
    const annoCol = collection(firestore, 'users', userId, 'annotations')
    const cloudSnap = await getDocs(annoCol)
    const cloudAnnotations = new Map<string, Annotation>()

    cloudSnap.forEach(snapshotDoc => {
        const data = snapshotDoc.data()
        cloudAnnotations.set(snapshotDoc.id, {
            ...data,
            id: snapshotDoc.id,
            userId,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt, data.createdAt)
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
            await db.annotations.put({
                ...cloud,
                userId,
                createdAt: toDate(cloud.createdAt),
                updatedAt: toDate(cloud.updatedAt, cloud.createdAt)
            } as Annotation)
        }
    }
}

/**
 * Sync collections
 */
async function syncCollections(userId: string): Promise<void> {
    const localCollections = await db.collections.where('userId').equals(userId).toArray()

    const colCol = collection(firestore, 'users', userId, 'collections')
    const cloudSnap = await getDocs(colCol)
    const cloudCollections = new Map<string, Collection>()

    cloudSnap.forEach(snapshotDoc => {
        const data = snapshotDoc.data()
        cloudCollections.set(snapshotDoc.id, {
            ...data,
            id: snapshotDoc.id,
            userId,
            createdAt: toDate(data.createdAt)
        } as Collection)
    })

    // Push local to cloud
    for (const local of localCollections) {
        if (!cloudCollections.has(local.id)) {
            await setDoc(doc(firestore, 'users', userId, 'collections', local.id), {
                id: local.id,
                userId,
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
            await db.collections.put({
                ...cloud,
                userId,
                createdAt: toDate(cloud.createdAt)
            } as Collection)
        }
    }
}

/**
 * Sync reading progress
 */
async function syncProgress(userId: string): Promise<void> {
    const localProgress = await db.progress.where('userId').equals(userId).toArray()

    const progCol = collection(firestore, 'users', userId, 'progress')
    const cloudSnap = await getDocs(progCol)
    const cloudProgress = new Map<string, ReadingProgress & { id?: number }>()

    cloudSnap.forEach(snapshotDoc => {
        const data = snapshotDoc.data() as ReadingProgress
        cloudProgress.set(snapshotDoc.id, {
            ...data,
            userId,
            lastUpdated: toDate(data.lastUpdated)
        })
    })

    // Push local to cloud when local is newer
    for (const local of localProgress) {
        const cloud = cloudProgress.get(local.bookId)
        const localUpdatedAt = toDate(local.lastUpdated)
        const cloudUpdatedAt = cloud ? toDate(cloud.lastUpdated) : undefined

        if (!cloud || isNewer(localUpdatedAt, cloudUpdatedAt)) {
            await setDoc(doc(firestore, 'users', userId, 'progress', local.bookId), {
                bookId: local.bookId,
                userId,
                location: local.location,
                percentage: local.percentage,
                chapterTitle: local.chapterTitle || null,
                lastUpdated: serverTimestamp()
            })
        }
    }

    // Pull cloud to local when cloud is newer
    for (const [bookId, cloud] of cloudProgress) {
        const local = localProgress.find(p => p.bookId === bookId && p.userId === userId)
        const localUpdatedAt = local ? toDate(local.lastUpdated) : undefined
        const cloudUpdatedAt = toDate(cloud.lastUpdated)

        if (!local || isNewer(cloudUpdatedAt, localUpdatedAt)) {
            const existing = await db.progress
                .where('[bookId+userId]')
                .equals([bookId, userId])
                .first()

            if (existing) {
                await db.progress.update(existing.id, {
                    location: cloud.location,
                    percentage: cloud.percentage,
                    chapterTitle: cloud.chapterTitle,
                    lastUpdated: cloudUpdatedAt
                })
                continue
            }

            await db.progress.add({
                bookId: cloud.bookId,
                userId,
                location: cloud.location,
                percentage: cloud.percentage,
                chapterTitle: cloud.chapterTitle,
                lastUpdated: cloudUpdatedAt
            } as ReadingProgress & { id: number })
        }
    }
}

/**
 * Sync book metadata (with storage URLs for cloud-only books)
 */
async function syncBookMetadata(userId: string): Promise<void> {
    const localBooks = await db.books.where('userId').equals(userId).toArray()

    const booksCol = collection(firestore, 'users', userId, 'books')
    const cloudSnap = await getDocs(booksCol)
    const cloudBooks = new Map<string, Partial<Book>>()

    cloudSnap.forEach(snapshotDoc => {
        const data = snapshotDoc.data() as Partial<Book>
        cloudBooks.set(snapshotDoc.id, {
            ...data,
            userId,
            addedAt: toDate(data.addedAt),
            lastReadAt: data.lastReadAt ? toDate(data.lastReadAt) : undefined
        })
    })

    // Push local book metadata to cloud (including storage URLs)
    for (const local of localBooks) {
        const existingCloud = cloudBooks.get(local.id)

        // Update if not in cloud or if we have storage URLs the cloud doesn't have
        if (!existingCloud || (local.storageUrl && !existingCloud.storageUrl)) {
            await setDoc(doc(firestore, 'users', userId, 'books', local.id), {
                id: local.id,
                userId,
                title: local.title,
                author: local.author,
                format: local.format,
                fileSize: local.fileSize,
                addedAt: local.addedAt,
                lastReadAt: local.lastReadAt || null,
                collectionIds: local.collectionIds || [],
                coverUrl: local.coverUrl || null,
                storageUrl: local.storageUrl || null,
                coverStorageUrl: local.coverStorageUrl || null,
                metadata: local.metadata
            })
        }
    }

    // Pull cloud books to local (as cloud-only if file not present locally)
    for (const [id, cloud] of cloudBooks) {
        const localBook = localBooks.find(b => b.id === id)

        if (!localBook && cloud.storageUrl) {
            // Create cloud-only book entry
            await db.books.add({
                id: cloud.id!,
                userId,
                title: cloud.title!,
                author: cloud.author!,
                format: cloud.format!,
                fileSize: cloud.fileSize || 0,
                metadata: cloud.metadata || { title: cloud.title!, author: cloud.author! },
                addedAt: toDate(cloud.addedAt),
                lastReadAt: cloud.lastReadAt ? toDate(cloud.lastReadAt) : undefined,
                collectionIds: cloud.collectionIds || [],
                coverUrl: cloud.coverUrl,
                storageUrl: cloud.storageUrl,
                coverStorageUrl: cloud.coverStorageUrl,
                isCloudOnly: true
                // Note: fileBlob is NOT set - this is a cloud-only book
            } as Book)

            console.log(`Synced cloud-only book: ${cloud.title}`)
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
                await db.annotations.put({
                    ...data,
                    id: change.doc.id,
                    userId,
                    createdAt: toDate(data.createdAt),
                    updatedAt: toDate(data.updatedAt, data.createdAt)
                } as Annotation)
            } else if (change.type === 'removed') {
                await db.annotations.delete(change.doc.id)
            }
        }
    })

    // Listen for collection changes
    const collectionsCol = collection(firestore, 'users', userId, 'collections')
    collectionsUnsubscribe = onSnapshot(collectionsCol, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            if (change.type === 'removed') {
                await db.collections.delete(change.doc.id)
                continue
            }

            const data = change.doc.data() as Collection
            await db.collections.put({
                ...data,
                id: change.doc.id,
                userId,
                createdAt: toDate(data.createdAt)
            })
        }
    })

    // Listen for progress changes
    const progressCol = collection(firestore, 'users', userId, 'progress')
    progressUnsubscribe = onSnapshot(progressCol, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            const progress = change.doc.data() as ReadingProgress
            const bookId = progress.bookId || change.doc.id

            if (change.type === 'removed') {
                await db.progress
                    .where('[bookId+userId]')
                    .equals([bookId, userId])
                    .delete()
                continue
            }

            const existing = await db.progress
                .where('[bookId+userId]')
                .equals([bookId, userId])
                .first()

            if (existing) {
                await db.progress.update(existing.id, {
                    location: progress.location,
                    percentage: progress.percentage,
                    chapterTitle: progress.chapterTitle,
                    lastUpdated: toDate(progress.lastUpdated)
                })
            } else {
                await db.progress.add({
                    bookId,
                    userId,
                    location: progress.location,
                    percentage: progress.percentage,
                    chapterTitle: progress.chapterTitle,
                    lastUpdated: toDate(progress.lastUpdated)
                } as ReadingProgress & { id: number })
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

function toDate(value: unknown, fallback: unknown = undefined): Date {
    if (value instanceof Date) return value
    if (value instanceof Timestamp) return value.toDate()
    if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
        return ((value as { toDate: () => Date }).toDate())
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value)
        if (!Number.isNaN(date.getTime())) return date
    }
    if (fallback !== undefined) return toDate(fallback)
    return new Date()
}
