import { useEffect, useCallback, useRef, useState } from 'react'
import type { Rendition } from 'epubjs'
import { useReaderStore } from '@/stores/readerStore'
import type { Annotation, HighlightColor, BookmarkColor } from '@/types'
import { addAnnotation, deleteAnnotation, updateAnnotation } from '@/services/storage/db'

interface UseEpubAnnotationsParams {
    bookId: string
    userId: string
    renditionRef: React.MutableRefObject<Rendition | null>
}

interface UseEpubAnnotationsResult {
    bookmarks: Annotation[]
    highlights: Annotation[]
    menuPosition: { x: number; y: number } | null
    setMenuPosition: (pos: { x: number; y: number } | null) => void
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
    handleSelectLocation: (cfi: string) => Promise<void>
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
        addAnnotationToState,
        removeAnnotationFromState,
        hideAnnotationMenu
    } = useReaderStore()

    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
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
                id: `highlight-${Date.now()}`,
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
            setMenuPosition(null)

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
        setMenuPosition(null)
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
            if (!currentLocation) return

            const newBookmark: Annotation = {
                id: `bookmark-${Date.now()}`,
                bookId,
                userId,
                type: 'bookmark',
                cfiRange: currentLocation,
                text: `Page ${percentage}%`,
                color,
                label,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            await addAnnotation(newBookmark)
            addAnnotationToState(newBookmark)
        }

        setShowBookmarkModal(false)
        setEditingBookmark(null)
    }, [bookId, userId, currentLocation, percentage, addAnnotationToState, removeAnnotationFromState, editingBookmark])

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

    const handleSelectLocation = useCallback(async (cfi: string) => {
        if (renditionRef.current && cfi) {
            await renditionRef.current.display(cfi)
        }
    }, [renditionRef])

    return {
        bookmarks,
        highlights,
        menuPosition,
        setMenuPosition,
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
