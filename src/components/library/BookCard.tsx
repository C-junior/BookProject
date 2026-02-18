import React from 'react'
import type { Book, Collection } from '@/types'
import { BookOpen, MoreVertical, Trash2, FolderPlus, Cloud, Download, Loader2, ImagePlus } from 'lucide-react'
import { downloadBookFile, downloadCoverImage, uploadCoverImage } from '@/services/storage/storageService'
import { updateBook } from '@/services/storage/db'
import { auth } from '@/services/firebase'
import './BookCard.css'

interface BookCardProps {
    book: Book
    progress?: number // 0-100 percentage
    collections?: Collection[]
    onOpen: (book: Book) => void
    onDelete: (book: Book) => void
    onAddToCollection?: (book: Book) => void
    onUpdateBook?: (id: string, updates: Partial<Book>) => Promise<void>
    onBookUpdated?: () => void // Callback when book is downloaded
}

export function BookCard({ book, progress, collections, onOpen, onDelete, onAddToCollection, onUpdateBook, onBookUpdated }: BookCardProps) {
    const [showMenu, setShowMenu] = React.useState(false)
    const [isDownloading, setIsDownloading] = React.useState(false)
    const [downloadProgress, setDownloadProgress] = React.useState(0)
    const menuRef = React.useRef<HTMLDivElement>(null)
    const customCoverInputRef = React.useRef<HTMLInputElement>(null)
    const [coverFailed, setCoverFailed] = React.useState(false)

    const isCloudOnly = book.isCloudOnly && !book.fileBlob

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false)
            }
        }

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showMenu])

    const localCoverUrl = React.useMemo(() => {
        if (!book.coverBlob) return null
        return URL.createObjectURL(book.coverBlob)
    }, [book.coverBlob])

    React.useEffect(() => {
        return () => {
            if (localCoverUrl) {
                URL.revokeObjectURL(localCoverUrl)
            }
        }
    }, [localCoverUrl])

    React.useEffect(() => {
        setCoverFailed(false)
    }, [book.id, book.coverUrl, book.coverStorageUrl, localCoverUrl])

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const handleClick = async () => {
        if (isCloudOnly) {
            await handleDownload()
        } else {
            onOpen(book)
        }
    }

    const handleDownload = async () => {
        if (!book.storageUrl || isDownloading) return

        setIsDownloading(true)
        setDownloadProgress(0)

        try {
            // Download the book file
            const fileBlob = await downloadBookFile(book.storageUrl, setDownloadProgress)

            // Download cover if available
            let coverBlob: Blob | undefined
            if (book.coverStorageUrl) {
                try {
                    coverBlob = await downloadCoverImage(book.coverStorageUrl)
                } catch {
                    // Cover download failed, continue without it
                }
            }

            // Update the book in IndexedDB with the downloaded file
            await updateBook(book.id, {
                fileBlob,
                coverBlob,
                isCloudOnly: false
            })

            // Notify parent to refresh
            onBookUpdated?.()

            // Open the book after download
            onOpen({ ...book, fileBlob, isCloudOnly: false })
        } catch (err) {
            console.error('Failed to download book:', err)
            const message = err instanceof Error ? err.message : 'Failed to download book.'
            alert(`${message} The cloud copy may have been deleted.`)
        } finally {
            setIsDownloading(false)
            setDownloadProgress(0)
        }
    }

    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowMenu(!showMenu)
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowMenu(false)
        onDelete(book)
    }

    const handleAddToCollection = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowMenu(false)
        onAddToCollection?.(book)
    }

    const handleCustomCoverClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setShowMenu(false)
        customCoverInputRef.current?.click()
    }

    const handleCustomCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        e.target.value = ''
        if (!selectedFile) return
        if (!selectedFile.type.startsWith('image/')) {
            alert('Please select an image file.')
            return
        }

        const compressedCoverBlob = await compressCoverImage(selectedFile)

        const updates: Partial<Book> = {
            coverBlob: compressedCoverBlob,
            coverUrl: undefined
        }

        try {
            const userId = auth.currentUser?.uid
            if (userId) {
                try {
                    updates.coverStorageUrl = await uploadCoverImage(userId, book.id, compressedCoverBlob)
                } catch (uploadErr) {
                    console.warn('Cover upload failed, keeping local custom cover only:', uploadErr)
                }
            }

            if (onUpdateBook) {
                await onUpdateBook(book.id, updates)
            } else {
                await updateBook(book.id, updates)
            }
            onBookUpdated?.()
        } catch (err) {
            console.error('Failed to set custom cover:', err)
            alert('Failed to set custom cover.')
        }
    }

    // Get book's assigned collections
    const bookCollections = collections?.filter(c => book.collectionIds?.includes(c.id)) || []

    // Use storage URL for cover if local cover not available
    const persistedCoverUrl = React.useMemo(() => {
        if (!book.coverUrl) return undefined
        if (isInvalidBlobCoverUrl(book.coverUrl)) return undefined
        return book.coverUrl
    }, [book.coverUrl])

    const coverUrl = coverFailed
        ? undefined
        : (localCoverUrl || persistedCoverUrl || book.coverStorageUrl)

    return (
        <article className={`book-card ${isCloudOnly ? 'book-card-cloud' : ''}`} onClick={handleClick}>
            {/* Cover */}
            <div className="book-card-cover">
                {coverUrl ? (
                    <img
                        src={coverUrl}
                        alt={`Cover of ${book.title}`}
                        className="book-card-cover-image"
                        onError={() => setCoverFailed(true)}
                    />
                ) : (
                    <div className="book-card-cover-placeholder">
                        <BookOpen size={32} />
                        <span className="book-card-cover-format">
                            {book.format.toUpperCase()}
                        </span>
                    </div>
                )}

                {/* Cloud indicator */}
                {isCloudOnly && !isDownloading && (
                    <div className="book-card-cloud-badge" title="Download from cloud">
                        <Cloud size={16} />
                    </div>
                )}

                {/* Download progress overlay */}
                {isDownloading && (
                    <div className="book-card-download-overlay">
                        <Loader2 size={24} className="book-card-spinner" />
                        <span className="book-card-download-text">{downloadProgress}%</span>
                    </div>
                )}

                {/* Collection badges */}
                {bookCollections.length > 0 && (
                    <div className="book-card-badges">
                        {bookCollections.slice(0, 2).map(col => (
                            <span
                                key={col.id}
                                className="book-card-badge"
                                style={{ backgroundColor: col.color }}
                                title={col.name}
                            />
                        ))}
                        {bookCollections.length > 2 && (
                            <span className="book-card-badge-more">+{bookCollections.length - 2}</span>
                        )}
                    </div>
                )}

                {/* Progress bar (if reading started) */}
                {typeof progress === 'number' && progress > 0 && !isCloudOnly && (
                    <div className="book-card-progress-container">
                        <div
                            className="book-card-progress-bar"
                            style={{ width: `${progress}%` }}
                        />
                        <span className="book-card-progress-text">{progress}%</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="book-card-info">
                <h3 className="book-card-title" title={book.title}>
                    {book.title}
                </h3>
                <p className="book-card-author" title={book.author}>
                    {book.author || 'Unknown Author'}
                </p>
                <div className="book-card-meta">
                    <span className="book-card-format">{book.format.toUpperCase()}</span>
                    {isCloudOnly ? (
                        <span className="book-card-cloud-label">
                            <Download size={12} /> Cloud
                        </span>
                    ) : (
                        <span className="book-card-size">{formatFileSize(book.fileSize)}</span>
                    )}
                </div>
            </div>

            {/* Menu button */}
            <div
                className="book-card-menu"
                ref={menuRef}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <input
                    ref={customCoverInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={handleCustomCoverSelected}
                />
                <button
                    className="book-card-menu-button"
                    onClick={handleMenuClick}
                    aria-label="Book options"
                    aria-expanded={showMenu}
                >
                    <MoreVertical size={18} />
                </button>

                {showMenu && (
                    <div
                        className="book-card-dropdown"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {isCloudOnly && (
                            <button
                                className="book-card-dropdown-item"
                                onClick={(e) => { e.stopPropagation(); handleDownload() }}
                            >
                                <Download size={16} />
                                <span>Download</span>
                            </button>
                        )}
                        {onAddToCollection && (
                            <button
                                className="book-card-dropdown-item"
                                onClick={handleAddToCollection}
                            >
                                <FolderPlus size={16} />
                                <span>Add to Collection</span>
                            </button>
                        )}
                        {book.format === 'epub' && (
                            <button
                                className="book-card-dropdown-item"
                                onClick={handleCustomCoverClick}
                            >
                                <ImagePlus size={16} />
                                <span>Custom Cover</span>
                            </button>
                        )}
                        <button
                            className="book-card-dropdown-item book-card-dropdown-item-danger"
                            onClick={handleDelete}
                        >
                            <Trash2 size={16} />
                            <span>Delete</span>
                        </button>
                    </div>
                )}
            </div>
        </article>
    )
}

export default BookCard

function isInvalidBlobCoverUrl(url: string): boolean {
    if (!url.startsWith('blob:')) return false
    const hasCurrentOrigin = url.includes(window.location.origin)
    return !hasCurrentOrigin
}

async function compressCoverImage(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file)
    const maxWidth = 1000
    const maxHeight = 1500
    const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        bitmap.close()
        throw new Error('Canvas context unavailable')
    }

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.8)
    })

    if (!blob) {
        throw new Error('Image compression failed')
    }

    return blob
}


