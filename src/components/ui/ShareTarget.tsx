import { useEffect, useState } from 'react'
import { parseBookFile } from '@/services/parsers'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUserStore } from '@/stores/userStore'
import { auth } from '@/services/firebase'
import { getActiveUserId } from '@/services/auth/session'
import { uploadBookFile, uploadCoverImage } from '@/services/storage/storageService'
import { updateBook } from '@/services/storage/db'
import type { Book } from '@/types'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import './ShareTarget.css'

interface ShareTargetProps {
    onComplete: () => void
}

export function ShareTarget({ onComplete }: ShareTargetProps) {
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
    const [message, setMessage] = useState('Processing shared file...')
    const { addNewBook } = useLibraryStore()

    useEffect(() => {
        handleSharedFile()
    }, [])

    const handleSharedFile = async () => {
        try {
            const url = new URL(window.location.href)
            const params = url.searchParams

            // Check for shared text (URL)
            const sharedUrl = params.get('url') || params.get('text')
            if (sharedUrl && (sharedUrl.endsWith('.epub') || sharedUrl.endsWith('.pdf'))) {
                setMessage('Downloading shared book...')
                const res = await fetch(sharedUrl)
                if (!res.ok) throw new Error(`Download failed (${res.status})`)
                const blob = await res.blob()
                const filename = sharedUrl.split('/').pop()?.split('?')[0] || 'book.epub'
                const file = new File([blob], filename, { type: blob.type })
                await importFile(file)
                return
            }

            // Check for POST body (multipart form data from Share Target API)
            if ('launchQueue' in window) {
                // File Handling API (modern approach)
                const launchQueue = (window as any).launchQueue
                launchQueue?.setConsumer?.(async (launchParams: any) => {
                    if (launchParams.files?.length > 0) {
                        const fileHandle = launchParams.files[0]
                        const file = await fileHandle.getFile()
                        await importFile(file)
                    }
                })
                return
            }

            // Fallback: try to read from cache (SW intercepted POST)
            const cache = await caches.open('share-target-cache')
            const cachedResponse = await cache.match('/share-target')
            if (cachedResponse) {
                const formData = await cachedResponse.formData()
                const file = formData.get('file') as File
                if (file) {
                    await cache.delete('/share-target')
                    await importFile(file)
                    return
                }
            }

            throw new Error('No shared file found')
        } catch (err) {
            console.error('Share target error:', err)
            setStatus('error')
            setMessage(err instanceof Error ? err.message : 'Failed to process shared file')
            setTimeout(onComplete, 3000)
        }
    }

    const importFile = async (file: File) => {
        setMessage(`Importing "${file.name}"...`)
        const userId = getActiveUserId(useUserStore.getState().currentUser?.id)

        const book = await parseBookFile(file)
        book.userId = userId

        await addNewBook(book)
        void uploadBookAssetsInBackground(book)
        setStatus('success')
        setMessage(`"${book.title}" added to your library!`)
        setTimeout(onComplete, 2000)
    }

    const uploadBookAssetsInBackground = async (book: Book) => {
        const firebaseUid = auth.currentUser?.uid
        if (!firebaseUid || !book.fileBlob) return

        try {
            const storageUrl = await uploadBookFile(firebaseUid, book.id, book.fileBlob, book.format)
            const updates: Partial<Book> = { storageUrl }

            if (book.coverBlob) {
                const coverStorageUrl = await uploadCoverImage(firebaseUid, book.id, book.coverBlob)
                updates.coverStorageUrl = coverStorageUrl
            }

            await updateBook(book.id, updates)
        } catch (uploadErr) {
            console.error('Failed to upload in background:', uploadErr)
        }
    }

    return (
        <div className="share-target">
            <div className="share-target-card">
                {status === 'processing' && (
                    <Loader2 size={40} className="share-target-spinner" />
                )}
                {status === 'success' && (
                    <CheckCircle size={40} className="share-target-success" />
                )}
                {status === 'error' && (
                    <AlertCircle size={40} className="share-target-error" />
                )}
                <p className="share-target-message">{message}</p>
            </div>
        </div>
    )
}
