/**
 * Firebase Storage Service
 * Upload and download book files to/from Firebase Storage
 */

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getApps } from 'firebase/app'

// Get existing Firebase app or create new one
const app = getApps()[0]
const storage = getStorage(app)

/**
 * Upload a book file to Firebase Storage
 * @returns Download URL for the uploaded file
 */
export async function uploadBookFile(
    userId: string,
    bookId: string,
    fileBlob: Blob,
    format: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    const filePath = `users/${userId}/books/${bookId}/book.${format}`
    const storageRef = ref(storage, filePath)

    // Upload the file
    await uploadBytes(storageRef, fileBlob, {
        contentType: getContentType(format)
    })

    // Get download URL
    const downloadUrl = await getDownloadURL(storageRef)

    if (onProgress) {
        onProgress(100)
    }

    return downloadUrl
}

/**
 * Upload a cover image to Firebase Storage
 * @returns Download URL for the cover
 */
export async function uploadCoverImage(
    userId: string,
    bookId: string,
    coverBlob: Blob
): Promise<string> {
    const filePath = `users/${userId}/books/${bookId}/cover.jpg`
    const storageRef = ref(storage, filePath)

    await uploadBytes(storageRef, coverBlob, {
        contentType: 'image/jpeg'
    })

    return await getDownloadURL(storageRef)
}

/**
 * Download a book file from Firebase Storage
 * @returns The file as a Blob
 */
export async function downloadBookFile(
    downloadUrl: string,
    onProgress?: (progress: number) => void
): Promise<Blob> {
    const response = await fetch(downloadUrl)

    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`)
    }

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0

    if (!response.body) {
        throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0

    while (true) {
        const { done, value } = await reader.read()

        if (done) break

        chunks.push(value)
        received += value.length

        if (onProgress && total > 0) {
            onProgress(Math.round((received / total) * 100))
        }
    }

    const allChunks = new Uint8Array(received)
    let position = 0
    for (const chunk of chunks) {
        allChunks.set(chunk, position)
        position += chunk.length
    }

    if (onProgress) {
        onProgress(100)
    }

    return new Blob([allChunks])
}

/**
 * Download a cover image from URL
 */
export async function downloadCoverImage(coverUrl: string): Promise<Blob> {
    const response = await fetch(coverUrl)
    if (!response.ok) {
        throw new Error(`Failed to download cover: ${response.statusText}`)
    }
    return await response.blob()
}

/**
 * Delete a book's files from Firebase Storage
 */
export async function deleteBookFiles(userId: string, bookId: string): Promise<void> {
    try {
        const bookRef = ref(storage, `users/${userId}/books/${bookId}/book.epub`)
        await deleteObject(bookRef)
    } catch {
        // File might not exist, ignore
    }

    try {
        const bookRefPdf = ref(storage, `users/${userId}/books/${bookId}/book.pdf`)
        await deleteObject(bookRefPdf)
    } catch {
        // File might not exist, ignore
    }

    try {
        const coverRef = ref(storage, `users/${userId}/books/${bookId}/cover.jpg`)
        await deleteObject(coverRef)
    } catch {
        // Cover might not exist, ignore
    }
}

/**
 * Get content type for file format
 */
function getContentType(format: string): string {
    switch (format.toLowerCase()) {
        case 'epub':
            return 'application/epub+zip'
        case 'pdf':
            return 'application/pdf'
        case 'mobi':
            return 'application/x-mobipocket-ebook'
        default:
            return 'application/octet-stream'
    }
}
