import { useEffect, useState } from 'react'
import { CheckoutButton } from '../subscription/CheckoutButton'
import { parseBookFile } from '@/services/parsers'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUserStore } from '@/stores/userStore'
import { auth, getUserProfile, isUserPro } from '@/services/firebase'
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
    const [showCheckout, setShowCheckout] = useState(false)
    const [pendingUrl, setPendingUrl] = useState<string | null>(null)
    const { addNewBook } = useLibraryStore()

    useEffect(() => {
        handleSharedFile()
    }, [])

    const verifyPremiumAccess = async (identifier: string): Promise<boolean> => {
        const isPremiumBook = identifier.includes('Chronicles_of_Synthborne')
        if (!isPremiumBook) return true;

        const currentUser = useUserStore.getState().currentUser
        if (currentUser?.isPro) return true;

        setMessage('Verifying subscription status...')
        let isVerifiedPro = false
        const uid = getActiveUserId(currentUser?.id)
        
        if (uid && uid !== 'default-user') {
            for (let i = 0; i < 3; i++) {
                try {
                    const profile = await getUserProfile(uid)
                    if (profile && isUserPro(profile)) {
                        isVerifiedPro = true
                        useUserStore.setState((state) => ({ 
                            currentUser: state.currentUser ? { ...state.currentUser, isPro: true } : null 
                        }))
                        break
                    }
                } catch (e) {
                    console.error('Failed to verify pro status', e)
                }
                if (!isVerifiedPro && i < 2) {
                    await new Promise(r => setTimeout(r, 1500))
                }
            }
        }
        
        if (!isVerifiedPro) {
            setStatus('error')
            setMessage('"Chronicles of Synthborne" is a Premium book. You need a Pro subscription to add it to your library.')
            setShowCheckout(true)
            if (identifier.startsWith('http')) {
                setPendingUrl(identifier)
                sessionStorage.setItem('pendingShareUrl', identifier)
            }
            return false;
        }

        return true;
    }

    const handleSharedFile = async () => {
        try {
            const url = new URL(window.location.href)
            const params = url.searchParams

            // 1. Check for shared text (URL)
            let sharedUrl = params.get('url') || params.get('text') || sessionStorage.getItem('pendingShareUrl');
            if (sharedUrl && (sharedUrl.endsWith('.epub') || sharedUrl.endsWith('.pdf'))) {
                const hasAccess = await verifyPremiumAccess(sharedUrl);
                if (!hasAccess) return;

                sessionStorage.removeItem('pendingShareUrl');
                setStatus('processing');
                setMessage('Downloading shared book...')
                const res = await fetch(sharedUrl)
                if (!res.ok) throw new Error(`Download failed (${res.status})`)
                const blob = await res.blob()
                const filename = sharedUrl.split('/').pop()?.split('?')[0] || 'book.epub'
                const file = new File([blob], filename, { type: blob.type })
                await importFile(file)
                return
            }

            // 2. Try to read from cache (SW intercepted POST for Share Target)
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

            // 3. Check for File Handling API (launchQueue)
            if ('launchQueue' in window) {
                let launchStarted = false
                const launchQueue = (window as any).launchQueue
                launchQueue?.setConsumer?.(async (launchParams: any) => {
                    if (launchParams.files?.length > 0) {
                        launchStarted = true
                        const fileHandle = launchParams.files[0]
                        const file = await fileHandle.getFile()
                        await importFile(file)
                    }
                })
                
                // Wait briefly to see if consumer was called synchronously with queued files
                await new Promise(r => setTimeout(r, 500))
                if (launchStarted) return
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
        const hasAccess = await verifyPremiumAccess(file.name);
        if (!hasAccess) return;

        setStatus('processing')
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
                {status === 'error' && !showCheckout && (
                    <AlertCircle size={40} className="share-target-error" />
                )}
                <p className="share-target-message">{message}</p>
                {status === 'error' && showCheckout && (
                    <CheckoutButton targetUrl={pendingUrl || undefined} />
                )}
            </div>
        </div>
    )
}

