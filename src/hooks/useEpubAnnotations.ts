import { useEffect, useCallback, useRef, useState } from 'react'
import type { Rendition } from 'epubjs'
import { useReaderStore } from '@/stores/readerStore'
import type { Annotation, HighlightColor, BookmarkColor } from '@/types'
import { addAnnotation, deleteAnnotation, updateAnnotation } from '@/services/storage/db'

function createAnnotationId(prefix: 'highlight' | 'bookmark'): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface UseEpubAnnotationsParams {
    bookId: string
    userId: string
    renditionRef: React.MutableRefObject<Rendition | null>
}

interface UseEpubAnnotationsResult {
    bookmarks: Annotation[]
    highlights: Annotation[]
    showBookmarkModal: boolean
    editingBookmark: Annotation | null
    dictionaryWord: string | null
    setDictionaryWord: (word: string | null) => void
    handleHighlight: (color: HighlightColor) => Promise<void>
    handleDismissMenu: () => void
    handleOpenBookmarkModal: () => void
    handleEditBookmark: (bookmark: Annotation) => void
    handleSaveBookmark: (label: string, color: BookmarkColor) => Promise<void>
    handleCancelBookmarkModal: () => void
    handleDeleteAnnotation: (id: string) => Promise<void>
    handleSelectLocation: (cfi: string, annotation?: Annotation) => Promise<void>
}

export function useEpubAnnotations({
    bookId,
    userId,
    renditionRef
}: UseEpubAnnotationsParams): UseEpubAnnotationsResult {
    const {
        currentLocation,
        percentage,
        selectionCfi,
        selectedText,
        annotations,
        preferences,
        addAnnotationToState,
        removeAnnotationFromState,
        hideAnnotationMenu
    } = useReaderStore()

    // Helper to get the live CFI from the rendition (more accurate than the store)
    const getLiveCfi = useCallback((): string => {
        try {
            const loc = renditionRef.current?.currentLocation() as any
            const cfi = loc?.start?.cfi
            if (cfi) return cfi
        } catch { /* fallback below */ }
        return currentLocation
    }, [renditionRef, currentLocation])

    const [showBookmarkModal, setShowBookmarkModal] = useState(false)
    const [editingBookmark, setEditingBookmark] = useState<Annotation | null>(null)
    const [dictionaryWord, setDictionaryWord] = useState<string | null>(null)
    const loadedAnnotationIds = useRef<Set<string>>(new Set())

    const bookmarks = annotations.filter(a => a.type === 'bookmark')
    const highlights = annotations.filter(a => a.type === 'highlight')

    // Sync highlights with rendition
    useEffect(() => {
        if (!renditionRef.current || annotations.length === 0) return

        annotations.forEach(annotation => {
            if (annotation.type === 'highlight' && annotation.cfiRange && !loadedAnnotationIds.current.has(annotation.id)) {
                try {
                    (renditionRef.current as any).annotations.add(
                        'highlight',
                        annotation.cfiRange,
                        {},
                        null,
                        `highlight-${annotation.color}`
                    )
                    loadedAnnotationIds.current.add(annotation.id)
                } catch (e) {
                    console.error('Error adding highlight to rendition', e)
                }
            }
        })
    }, [annotations, renditionRef])

    const handleHighlight = useCallback(async (color: HighlightColor) => {
        if (!renditionRef.current || !selectionCfi) return

        try {
            const highlight: Annotation = {
                id: createAnnotationId('highlight'),
                bookId,
                userId,
                type: 'highlight',
                cfiRange: selectionCfi,
                text: selectedText,
                color,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            await addAnnotation(highlight)
            addAnnotationToState(highlight);

            (renditionRef.current as any).annotations.add('highlight', selectionCfi, {}, (e: any) => {
                console.log('Highlight clicked', e)
            }, `highlight-${color}`)

            hideAnnotationMenu()

            const contents = (renditionRef.current as any).getContents()
            contents.forEach((content: any) => {
                content.window.getSelection()?.removeAllRanges()
            })
        } catch (err) {
            console.error('Error adding highlight:', err)
        }
    }, [bookId, userId, selectionCfi, selectedText, addAnnotationToState, hideAnnotationMenu, renditionRef])

    const handleDismissMenu = useCallback(() => {
        hideAnnotationMenu()
        if (renditionRef.current) {
            const contents = (renditionRef.current as any).getContents()
            contents.forEach((content: any) => {
                content.window.getSelection()?.removeAllRanges()
            })
        }
    }, [hideAnnotationMenu, renditionRef])

    const handleOpenBookmarkModal = useCallback(() => {
        if (!currentLocation) return
        setEditingBookmark(null)
        setShowBookmarkModal(true)
    }, [currentLocation])

    const handleEditBookmark = useCallback((bookmark: Annotation) => {
        setEditingBookmark(bookmark)
        setShowBookmarkModal(true)
    }, [])

    const handleSaveBookmark = useCallback(async (label: string, color: BookmarkColor) => {
        if (editingBookmark) {
            await updateAnnotation(editingBookmark.id, { label, color })
            removeAnnotationFromState(editingBookmark.id)
            addAnnotationToState({
                ...editingBookmark,
                label,
                color,
                updatedAt: new Date()
            })
        } else {
            // Capture the live CFI at the exact moment user saves
            const liveCfi = getLiveCfi()
            if (!liveCfi) return

            // Capture scroll offset in vertical scroll mode for precise restoration
            let note: string | undefined
            const isVertical = preferences.readingMode === 'vertical-scroll'
            if (isVertical) {
                try {
                    const container = document.querySelector('.epub-reader-container')
                    if (container) {
                        const scrollPercent = container.scrollHeight > container.clientHeight
                            ? container.scrollTop / (container.scrollHeight - container.clientHeight)
                            : 0
                        note = JSON.stringify({ scrollOffset: scrollPercent })
                    }
                } catch { /* ignore */ }
            }

            const newBookmark: Annotation = {
                id: createAnnotationId('bookmark'),
                bookId,
                userId,
                type: 'bookmark',
                cfiRange: liveCfi,
                text: `Page ${percentage}%`,
                color,
                label,
                note,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            await addAnnotation(newBookmark)
            addAnnotationToState(newBookmark)
        }

        setShowBookmarkModal(false)
        setEditingBookmark(null)
    }, [bookId, userId, getLiveCfi, percentage, preferences.readingMode, addAnnotationToState, removeAnnotationFromState, editingBookmark])

    const handleCancelBookmarkModal = useCallback(() => {
        setShowBookmarkModal(false)
        setEditingBookmark(null)
    }, [])

    const handleDeleteAnnotation = useCallback(async (id: string) => {
        const annotation = annotations.find(a => a.id === id)

        if (annotation?.type === 'highlight' && annotation.cfiRange && renditionRef.current) {
            try {
                (renditionRef.current as any).annotations.remove(annotation.cfiRange, 'highlight')
                if (currentLocation) {
                    await renditionRef.current.display(currentLocation)
                }
            } catch (err) {
                console.error('Error removing highlight from rendition:', err)
            }
        }

        await deleteAnnotation(id)
        removeAnnotationFromState(id)

        if (loadedAnnotationIds.current.has(id)) {
            loadedAnnotationIds.current.delete(id)
        }
    }, [annotations, currentLocation, removeAnnotationFromState, renditionRef])

    const handleSelectLocation = useCallback(async (cfi: string, annotation?: Annotation) => {
        if (renditionRef.current && cfi) {
            await renditionRef.current.display(cfi)

            // Restore scroll offset in vertical scroll mode
            if (annotation?.note && preferences.readingMode === 'vertical-scroll') {
                try {
                    const meta = JSON.parse(annotation.note)
                    if (typeof meta.scrollOffset === 'number') {
                        // Wait for render, then scroll to saved offset
                        requestAnimationFrame(() => {
                            const container = document.querySelector('.epub-reader-container')
                            if (container) {
                                const scrollTarget = meta.scrollOffset * (container.scrollHeight - container.clientHeight)
                                container.scrollTo({ top: scrollTarget, behavior: 'smooth' })
                            }
                        })
                    }
                } catch { /* note is not scroll metadata, ignore */ }
            }
        }
    }, [renditionRef, preferences.readingMode])

    return {
        bookmarks,
        highlights,
        showBookmarkModal,
        editingBookmark,
        dictionaryWord,
        setDictionaryWord,
        handleHighlight,
        handleDismissMenu,
        handleOpenBookmarkModal,
        handleEditBookmark,
        handleSaveBookmark,
        handleCancelBookmarkModal,
        handleDeleteAnnotation,
        handleSelectLocation
    }
}
