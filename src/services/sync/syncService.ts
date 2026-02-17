/**
 * Cloud Sync Service
 * Offline-first: all writes go to IndexedDB first, sync to Firebase only when
 * online and necessary. Uses dirty-flag queue to batch changes on reconnect.
 */

import { auth, db as firestore } from '@/services/firebase'
import { db } from '@/services/storage/db'
import { useSyncStore } from '@/stores/syncStore'
import { getDeviceName } from '@/stores/syncStore'
import type { DirtyCategory } from '@/stores/syncStore'
import {
    collection,
    doc,
    getDocs,
    setDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore'
import type { Annotation, Collection, ReadingProgress, Book } from '@/types'

// Debounce timer for sync operations
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SYNC_DEBOUNCE_MS = 5000 // 5s — reduces Firebase writes during active reading

// Minimum interval between full syncs triggered by visibility change
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Sync all data types to/from Firestore (full bidirectional)
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
        const categories = [
            { name: 'annotations' as const, fn: () => syncAnnotations(userId) },
            { name: 'collections' as const, fn: () => syncCollections(userId) },
            { name: 'progress' as const, fn: () => syncProgress(userId) },
            { name: 'bookMetadata' as const, fn: () => syncBookMetadata(userId) }
        ]

        const results = await Promise.allSettled(categories.map(c => c.fn()))

        const store = useSyncStore.getState()
        let hasFailure = false

        results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                store.clearDirty(categories[i].name)
            } else {
                hasFailure = true
                console.error(`Sync failed for ${categories[i].name}:`, result.reason)
                addSyncError(formatSyncError(categories[i].name, result.reason))
            }
        })

        setLastSyncTime(new Date())
        useSyncStore.getState().setLastSyncDevice(getDeviceName())
        console.log(hasFailure ? 'Sync completed with partial failures' : 'Sync completed successfully')
    } catch (error) {
        console.error('Sync failed:', error)
        addSyncError(formatSyncError('syncAll', error))
    } finally {
        setSyncing(false)
    }
}

/**
 * Flush only dirty categories to Firebase (lightweight sync)
 */
export async function flushDirtyData(): Promise<void> {
    const userId = auth.currentUser?.uid
    if (!userId) return

    const { isOnline, isSyncing, setSyncing, setLastSyncTime, addSyncError } = useSyncStore.getState()
    if (!isOnline || isSyncing) return

    const dirtyCategories = useSyncStore.getState().getDirtyCategories()
    if (dirtyCategories.length === 0) return

    setSyncing(true)
    console.log('Flushing dirty categories:', dirtyCategories)

    try {
        const tasks: Promise<void>[] = []
        const categoryMap: Record<DirtyCategory, () => Promise<void>> = {
            progress: () => syncProgress(userId),
            annotations: () => syncAnnotations(userId),
            collections: () => syncCollections(userId),
            bookMetadata: () => syncBookMetadata(userId)
        }

        for (const category of dirtyCategories) {
            tasks.push(
                categoryMap[category]().then(() => {
                    useSyncStore.getState().clearDirty(category)
                })
            )
        }

        await Promise.all(tasks)
        setLastSyncTime(new Date())
        console.log('Dirty flush completed')
    } catch (error) {
        console.error('Dirty flush failed:', error)
        addSyncError(formatSyncError('flushDirtyData', error))
    } finally {
        setSyncing(false)
    }
}

/**
 * Debounced sync — if offline, just marks dirty; if online, schedules sync
 */
export function debouncedSync(): void {
    const { isOnline } = useSyncStore.getState()

    // Always mark progress dirty so we know to sync later
    useSyncStore.getState().markDirty('progress')

    if (!isOnline) {
        // Offline: dirty flag is set, try Background Sync API
        requestBackgroundSync()
        return
    }

    if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer)
    }

    syncDebounceTimer = setTimeout(() => {
        flushDirtyData()
    }, SYNC_DEBOUNCE_MS)
}

/**
 * Sync annotations (highlights, bookmarks, notes)
 */
async function syncAnnotations(userId: string): Promise<void> {
    const localAnnotations = await db.annotations.where('userId').equals(userId).toArray()

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
            const payload = sanitizeForFirestore({
                id: local.id,
                userId,
                title: local.title,
                author: local.author,
                format: local.format,
                fileSize: local.fileSize,
                addedAt: local.addedAt,
                lastReadAt: local.lastReadAt || null,
                collectionIds: local.collectionIds || [],
                coverUrl: normalizeSyncedCoverUrl(local.coverUrl),
                storageUrl: local.storageUrl || null,
                coverStorageUrl: local.coverStorageUrl || null,
                metadata: local.metadata
            })

            await setDoc(doc(firestore, 'users', userId, 'books', local.id), payload)
        }
    }

    // Pull cloud books to local (as cloud-only if file not present locally)
    for (const [id, cloud] of cloudBooks) {
        const localBook = localBooks.find(b => b.id === id)

        if (!localBook && cloud.storageUrl) {
            // Create/update cloud-only book entry (put = upsert, avoids ConstraintError)
            await db.books.put({
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
 * Sync on login — initial sync when user authenticates
 * Does a full bidirectional sync, then sets up auto-flush on reconnect
 * and visibility-based sync for tab switches.
 */
export async function syncOnLogin(): Promise<void> {
    await syncAll()
    initSyncListeners()
}

/**
 * Sync on logout — stop listeners
 */
export function syncOnLogout(): void {
    teardownSyncListeners()
}

// ============================================
// Lifecycle listeners (replace real-time Firestore listeners)
// ============================================

let onlineHandler: (() => void) | null = null
let visibilityHandler: (() => void) | null = null

function initSyncListeners(): void {
    // Flush queued dirty data when coming back online
    onlineHandler = () => {
        console.log('Back online — flushing dirty data')
        flushDirtyData()
    }
    window.addEventListener('online', onlineHandler)

    // Re-sync when tab becomes visible (if enough time has passed)
    visibilityHandler = () => {
        if (document.visibilityState !== 'visible') return

        const { lastSyncTime } = useSyncStore.getState()
        const elapsed = lastSyncTime
            ? Date.now() - lastSyncTime.getTime()
            : Infinity

        if (elapsed >= MIN_SYNC_INTERVAL_MS) {
            console.log('Tab visible after', Math.round(elapsed / 1000), 's — syncing')
            syncAll()
        }
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    console.log('Sync listeners initialized (on-demand, no real-time)')
}

function teardownSyncListeners(): void {
    if (onlineHandler) {
        window.removeEventListener('online', onlineHandler)
        onlineHandler = null
    }
    if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler)
        visibilityHandler = null
    }
    console.log('Sync listeners removed')
}

// ============================================
// Helpers
// ============================================

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

function formatSyncError(scope: string, error: unknown): string {
    if (error instanceof Error) {
        return `${scope}: ${error.message}`
    }
    if (typeof error === 'string') {
        return `${scope}: ${error}`
    }
    return `${scope}: Unknown error`
}

function sanitizeForFirestore<T>(value: T): T {
    if (value === null || value === undefined) {
        return value
    }

    if (value instanceof Date || value instanceof Timestamp) {
        return value
    }

    if (Array.isArray(value)) {
        const arr = value
            .filter((item) => item !== undefined)
            .map((item) => sanitizeForFirestore(item))
        return arr as T
    }

    if (typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (v === undefined) continue
            out[k] = sanitizeForFirestore(v)
        }
        return out as T
    }

    return value
}

function normalizeSyncedCoverUrl(coverUrl?: string): string | null {
    if (!coverUrl) return null
    if (coverUrl.startsWith('blob:')) return null
    if (coverUrl.startsWith('http://localhost') || coverUrl.startsWith('https://localhost')) return null
    return coverUrl
}

/**
 * Request background sync via the SW Registration API.
 * Falls back silently on unsupported browsers (Safari/Firefox).
 */
export async function requestBackgroundSync(): Promise<void> {
    try {
        const registration = await navigator.serviceWorker?.ready
        if (registration && 'sync' in registration) {
            await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('codex-sync')
            console.log('Background sync registered: codex-sync')
        }
    } catch {
        // Background Sync not supported — handled by online listener fallback
    }
}
