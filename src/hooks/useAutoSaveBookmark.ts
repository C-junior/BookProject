import { useEffect, useRef, useCallback } from 'react'
import { useReaderStore } from '@/stores/readerStore'
import { upsertAutoSaveBookmark } from '@/services/storage/db'
import type { Annotation } from '@/types'

interface UseAutoSaveBookmarkOptions {
    bookId: string
    userId: string
    enabled?: boolean
    intervalMs?: number
}

/**
 * Hook that auto-saves reading position as a special bookmark
 * Only one auto-save bookmark exists per book (overwrites previous)
 */
export function useAutoSaveBookmark({
    bookId,
    userId,
    enabled = true,
    intervalMs = 60000 // Default: 60 seconds
}: UseAutoSaveBookmarkOptions) {
    const { currentLocation, percentage, chapterTitle, addAnnotationToState, annotations } = useReaderStore()
    const lastSavedLocationRef = useRef<string>('')

    const savePosition = useCallback(async () => {
        // Don't save if disabled or no location
        if (!enabled || !currentLocation || !bookId) return

        // Don't save if position hasn't changed
        if (currentLocation === lastSavedLocationRef.current) return

        const autoSaveId = `autosave-${userId}-${bookId}`

        const autoSaveBookmark: Annotation = {
            id: autoSaveId,
            bookId,
            userId,
            type: 'bookmark',
            cfiRange: currentLocation,
            text: chapterTitle || `${percentage}% complete`,
            color: 'yellow',
            note: 'Auto-saved position',
            createdAt: new Date(),
            updatedAt: new Date()
        }

        try {
            await upsertAutoSaveBookmark(autoSaveBookmark)
            lastSavedLocationRef.current = currentLocation

            // Update state if not already present
            const existingIndex = annotations.findIndex(a => a.id === autoSaveId)
            if (existingIndex === -1) {
                addAnnotationToState(autoSaveBookmark)
            }
        } catch (error) {
            console.error('Auto-save bookmark failed:', error)
        }
    }, [enabled, currentLocation, bookId, userId, percentage, chapterTitle, annotations, addAnnotationToState])

    // Auto-save on interval
    useEffect(() => {
        if (!enabled) return

        const interval = setInterval(savePosition, intervalMs)

        return () => clearInterval(interval)
    }, [enabled, intervalMs, savePosition])

    // Save immediately when location changes significantly (debounced by interval)
    // Also save on unmount
    useEffect(() => {
        return () => {
            if (enabled && currentLocation && currentLocation !== lastSavedLocationRef.current) {
                savePosition()
            }
        }
    }, [enabled, currentLocation, savePosition])

    return { savePosition }
}
