import { useCallback } from 'react'
import type { Annotation } from '@/types'
import { Download, Share2 } from 'lucide-react'
import './ExportAnnotations.css'

interface ExportAnnotationsProps {
    bookTitle: string
    bookmarks: Annotation[]
    highlights: Annotation[]
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

function toMarkdown(bookTitle: string, bookmarks: Annotation[], highlights: Annotation[]): string {
    const lines: string[] = []
    lines.push(`# ${bookTitle} — Annotations`)
    lines.push('')
    lines.push(`*Exported on ${formatDate(new Date())}*`)
    lines.push('')

    if (bookmarks.length > 0) {
        lines.push('## Bookmarks')
        lines.push('')
        for (const bm of bookmarks) {
            const label = bm.label || bm.text || 'Unnamed'
            lines.push(`- **${label}** — ${formatDate(bm.createdAt)}`)
            if (bm.note) lines.push(`  > ${bm.note}`)
        }
        lines.push('')
    }

    if (highlights.length > 0) {
        lines.push('## Highlights')
        lines.push('')
        for (const hl of highlights) {
            lines.push(`> ${hl.text}`)
            if (hl.note) lines.push(`> — *${hl.note}*`)
            lines.push(`> *(${hl.color}, ${formatDate(hl.createdAt)})*`)
            lines.push('')
        }
    }

    if (bookmarks.length === 0 && highlights.length === 0) {
        lines.push('*No annotations yet.*')
    }

    return lines.join('\n')
}

function toJson(bookTitle: string, bookmarks: Annotation[], highlights: Annotation[]): string {
    return JSON.stringify({
        book: bookTitle,
        exportedAt: new Date().toISOString(),
        bookmarks: bookmarks.map(bm => ({
            label: bm.label || bm.text,
            cfi: bm.cfiRange,
            color: bm.color,
            note: bm.note,
            createdAt: bm.createdAt
        })),
        highlights: highlights.map(hl => ({
            text: hl.text,
            cfi: hl.cfiRange,
            color: hl.color,
            note: hl.note,
            createdAt: hl.createdAt
        }))
    }, null, 2)
}

async function shareOrDownload(content: string, filename: string, mimeType: string) {
    // Try native share first (mobile)
    if (navigator.share && navigator.canShare?.({ files: [new File([content], filename, { type: mimeType })] })) {
        try {
            await navigator.share({
                title: filename,
                files: [new File([content], filename, { type: mimeType })]
            })
            return
        } catch {
            // User cancelled or error — fall through to download
        }
    }

    // Fallback: download file
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

export function ExportAnnotations({ bookTitle, bookmarks, highlights }: ExportAnnotationsProps) {
    const total = bookmarks.length + highlights.length
    const safeTitle = bookTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_')

    const handleExportMarkdown = useCallback(async () => {
        const md = toMarkdown(bookTitle, bookmarks, highlights)
        await shareOrDownload(md, `${safeTitle}_annotations.md`, 'text/markdown')
    }, [bookTitle, bookmarks, highlights, safeTitle])

    const handleExportJson = useCallback(async () => {
        const json = toJson(bookTitle, bookmarks, highlights)
        await shareOrDownload(json, `${safeTitle}_annotations.json`, 'application/json')
    }, [bookTitle, bookmarks, highlights, safeTitle])

    if (total === 0) return null

    const canShare = typeof navigator.share === 'function'
    const Icon = canShare ? Share2 : Download

    return (
        <div className="export-annotations">
            <button
                className="export-btn"
                onClick={handleExportMarkdown}
                title="Export as Markdown"
            >
                <Icon size={14} />
                <span>Markdown</span>
            </button>
            <button
                className="export-btn"
                onClick={handleExportJson}
                title="Export as JSON"
            >
                <Icon size={14} />
                <span>JSON</span>
            </button>
        </div>
    )
}
