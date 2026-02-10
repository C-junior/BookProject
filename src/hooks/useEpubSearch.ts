import { useCallback } from 'react'
import type { SearchResult, TocItem } from '@/types'

interface UseEpubSearchParams {
    bookRef: React.MutableRefObject<any>
    toc: TocItem[]
    renditionRef: React.MutableRefObject<any>
}

interface UseEpubSearchResult {
    handleSearch: (query: string) => Promise<SearchResult[]>
    handleSearchNavigate: (cfi: string) => Promise<void>
}

export function useEpubSearch({
    bookRef,
    toc,
    renditionRef
}: UseEpubSearchParams): UseEpubSearchResult {

    const handleSearch = useCallback(async (query: string): Promise<SearchResult[]> => {
        if (!bookRef.current || !query.trim()) {
            return []
        }

        try {
            const spine = bookRef.current.spine
            const results: SearchResult[] = []

            for (let i = 0; i < spine.items.length; i++) {
                const item = spine.items[i]
                if (!item) continue

                await item.load(bookRef.current.load.bind(bookRef.current))

                const chapter = toc.find(t => item.href?.includes(t.href))?.label || `Chapter ${i + 1}`

                const matches = await item.find(query)

                for (const match of matches) {
                    results.push({
                        cfi: match.cfi,
                        excerpt: match.excerpt || '',
                        chapter
                    })
                }

                if (results.length >= 100) break
            }

            return results
        } catch (err) {
            console.error('Search error:', err)
            return []
        }
    }, [bookRef, toc])

    const handleSearchNavigate = useCallback(async (cfi: string) => {
        if (renditionRef.current && cfi) {
            await renditionRef.current.display(cfi)
        }
    }, [renditionRef])

    return { handleSearch, handleSearchNavigate }
}
