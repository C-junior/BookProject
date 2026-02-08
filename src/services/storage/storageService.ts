/**
 * Storage Service using Supabase Storage
 * Upload and download book files
 */

import { supabase, BOOKS_BUCKET } from '@/services/supabase'

/**
 * Upload a book file to Supabase Storage
 * @returns Public URL for the uploaded file
 */
export async function uploadBookFile(
    userId: string,
    bookId: string,
    fileBlob: Blob,
    format: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    const filePath = `${userId}/${bookId}/book.${format}`

    // Upload to Supabase Storage
    const { error } = await supabase.storage
        .from(BOOKS_BUCKET)
        .upload(filePath, fileBlob, {
            contentType: getContentType(format),
            upsert: true
        })

    if (error) {
        throw new Error(`Upload failed: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(BOOKS_BUCKET)
        .getPublicUrl(filePath)

    if (onProgress) {
        onProgress(100)
    }

    return urlData.publicUrl
}

/**
 * Upload a cover image to Supabase Storage
 * @returns Public URL for the cover
 */
export async function uploadCoverImage(
    userId: string,
    bookId: string,
    coverBlob: Blob
): Promise<string> {
    const filePath = `${userId}/${bookId}/cover.jpg`

    const { error } = await supabase.storage
        .from(BOOKS_BUCKET)
        .upload(filePath, coverBlob, {
            contentType: 'image/jpeg',
            upsert: true
        })

    if (error) {
        throw new Error(`Cover upload failed: ${error.message}`)
    }

    const { data: urlData } = supabase.storage
        .from(BOOKS_BUCKET)
        .getPublicUrl(filePath)

    return urlData.publicUrl
}

/**
 * Download a book file from Supabase Storage
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
 * Delete a book's files from Supabase Storage
 */
export async function deleteBookFiles(userId: string, bookId: string): Promise<void> {
    const filesToDelete = [
        `${userId}/${bookId}/book.epub`,
        `${userId}/${bookId}/book.pdf`,
        `${userId}/${bookId}/cover.jpg`
    ]

    await supabase.storage
        .from(BOOKS_BUCKET)
        .remove(filesToDelete)
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
