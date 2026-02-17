/**
 * Book file parser - detects format and extracts metadata
 */

import type { Book, BookFormat, BookMetadata } from '@/types'

/**
 * Generate a unique ID for a book
 */
function generateBookId(): string {
    return `book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Detect book format from file extension
 */
function detectFormat(fileName: string): BookFormat {
    const ext = fileName.split('.').pop()?.toLowerCase()

    switch (ext) {
        case 'epub':
            return 'epub'
        case 'pdf':
            return 'pdf'
        case 'mobi':
        case 'azw':
        case 'azw3':
            return 'mobi'
        case 'txt':
            return 'txt'
        case 'html':
        case 'htm':
            return 'html'
        default:
            throw new Error(`Unsupported file format: ${ext}`)
    }
}

/**
 * Extract title from filename
 */
function extractTitleFromFilename(fileName: string): string {
    // Remove extension
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')

    // Replace common separators with spaces
    const cleaned = nameWithoutExt
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    // Capitalize first letter of each word
    return cleaned
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
}

/**
 * Parse EPUB file and extract metadata
 */
async function parseEpub(file: File): Promise<{ metadata: BookMetadata; coverUrl?: string; coverBlob?: Blob }> {
    try {
        // Dynamic import to avoid loading epub.js until needed
        const ePub = (await import('epubjs')).default

        const arrayBuffer = await file.arrayBuffer()
        const book = new ePub(arrayBuffer)

        // Wait for metadata to load
        const metadata = await book.loaded.metadata

        // Try to get cover
        let coverUrl: string | undefined
        let coverBlob: Blob | undefined
        try {
            const coverUrlResult = await book.coverUrl()
            if (coverUrlResult) {
                if (isEphemeralUrl(coverUrlResult)) {
                    try {
                        const response = await fetch(coverUrlResult)
                        if (response.ok) {
                            coverBlob = await response.blob()
                            coverUrl = await blobToDataUrl(coverBlob)
                        }
                    } catch {
                        // Ignore invalid temporary URL covers
                    }
                } else {
                    coverUrl = coverUrlResult
                }
            }
        } catch {
            // Cover extraction failed, continue without cover
        }

        // Clean up
        book.destroy()

        return {
            metadata: {
                title: metadata.title || extractTitleFromFilename(file.name),
                author: metadata.creator || 'Unknown Author',
                description: metadata.description,
                publisher: metadata.publisher,
                publishDate: metadata.pubdate,
                language: metadata.language
            },
            coverUrl,
            coverBlob
        }
    } catch (error) {
        console.error('Error parsing EPUB:', error)
        // Return basic metadata if parsing fails
        return {
            metadata: {
                title: extractTitleFromFilename(file.name),
                author: 'Unknown Author'
            }
        }
    }
}

/**
 * Parse PDF file and extract metadata
 */
async function parsePdf(file: File): Promise<{ metadata: BookMetadata; coverUrl?: string }> {
    try {
        // Dynamic import to avoid loading pdfjs until needed
        const pdfjsLib = await import('pdfjs-dist')

        // Set worker path
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.mjs',
            import.meta.url
        ).href

        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        // Get metadata
        const pdfMetadata = await pdf.getMetadata()
        const info = pdfMetadata.info as Record<string, string | undefined>

        // Try to generate cover from first page
        let coverUrl: string | undefined
        try {
            const page = await pdf.getPage(1)
            const scale = 1.5
            const viewport = page.getViewport({ scale })

            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d')

            if (context) {
                canvas.height = viewport.height
                canvas.width = viewport.width

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise

                coverUrl = canvas.toDataURL('image/jpeg', 0.8)
            }
        } catch {
            // Cover generation failed, continue without cover
        }

        return {
            metadata: {
                title: info?.Title || extractTitleFromFilename(file.name),
                author: info?.Author || 'Unknown Author',
                description: info?.Subject,
                pageCount: pdf.numPages
            },
            coverUrl
        }
    } catch (error) {
        console.error('Error parsing PDF:', error)
        return {
            metadata: {
                title: extractTitleFromFilename(file.name),
                author: 'Unknown Author'
            }
        }
    }
}

/**
 * Parse text file - minimal metadata extraction
 */
async function parseText(file: File): Promise<{ metadata: BookMetadata }> {
    // For text files, we just use the filename as the title
    return {
        metadata: {
            title: extractTitleFromFilename(file.name),
            author: 'Unknown Author'
        }
    }
}

/**
 * Main parser function - detects format and extracts metadata
 */
export async function parseBookFile(file: File): Promise<Book> {
    const format = detectFormat(file.name)

    let metadata: BookMetadata
    let coverUrl: string | undefined
    let coverBlob: Blob | undefined

    switch (format) {
        case 'epub':
            const epubResult = await parseEpub(file)
            metadata = epubResult.metadata
            coverUrl = epubResult.coverUrl
            coverBlob = epubResult.coverBlob
            break

        case 'pdf':
            const pdfResult = await parsePdf(file)
            metadata = pdfResult.metadata
            coverUrl = pdfResult.coverUrl
            break

        case 'txt':
        case 'html':
            const textResult = await parseText(file)
            metadata = textResult.metadata
            break

        case 'mobi':
            // MOBI parsing is complex - use basic metadata for now
            metadata = {
                title: extractTitleFromFilename(file.name),
                author: 'Unknown Author'
            }
            break

        default:
            throw new Error(`Unsupported format: ${format}`)
    }

    const book: Book = {
        id: generateBookId(),
        title: metadata.title,
        author: metadata.author,
        format,
        coverUrl,
        coverBlob,
        fileBlob: file,
        fileSize: file.size,
        metadata,
        addedAt: new Date()
    }

    return book
}

export default parseBookFile

function isEphemeralUrl(url: string): boolean {
    return url.startsWith('blob:') || url.startsWith('http://localhost') || url.startsWith('https://localhost')
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result)
                return
            }
            reject(new Error('Failed to convert blob to data URL'))
        }
        reader.onerror = () => reject(reader.error || new Error('Failed to read blob'))
        reader.readAsDataURL(blob)
    })
}
