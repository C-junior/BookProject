/**
 * Dictionary & Wikipedia Lookup Service
 */

export interface DictionaryDefinition {
    word: string
    phonetic?: string
    meanings: {
        partOfSpeech: string
        definitions: {
            definition: string
            example?: string
        }[]
    }[]
}

export interface WikipediaSummary {
    title: string
    extract: string
    thumbnail?: {
        source: string
        width: number
        height: number
    }
    pageUrl: string
}

/**
 * Fetch word definition from Free Dictionary API
 */
export async function fetchDefinition(word: string): Promise<DictionaryDefinition | null> {
    try {
        const cleanWord = word.trim().toLowerCase().split(/\s+/)[0] // Get first word only
        const response = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`
        )

        if (!response.ok) {
            if (response.status === 404) return null
            throw new Error('Dictionary lookup failed')
        }

        const data = await response.json()
        const entry = data[0]

        return {
            word: entry.word,
            phonetic: entry.phonetic || entry.phonetics?.[0]?.text,
            meanings: entry.meanings.map((m: any) => ({
                partOfSpeech: m.partOfSpeech,
                definitions: m.definitions.slice(0, 3).map((d: any) => ({
                    definition: d.definition,
                    example: d.example
                }))
            }))
        }
    } catch (error) {
        console.error('Dictionary lookup error:', error)
        return null
    }
}

/**
 * Fetch Wikipedia summary for a term
 */
export async function fetchWikipediaSummary(term: string): Promise<WikipediaSummary | null> {
    try {
        const cleanTerm = term.trim()
        const response = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTerm)}`,
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        )

        if (!response.ok) {
            if (response.status === 404) return null
            throw new Error('Wikipedia lookup failed')
        }

        const data = await response.json()

        // Skip disambiguation pages
        if (data.type === 'disambiguation') {
            return null
        }

        return {
            title: data.title,
            extract: data.extract,
            thumbnail: data.thumbnail ? {
                source: data.thumbnail.source,
                width: data.thumbnail.width,
                height: data.thumbnail.height
            } : undefined,
            pageUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`
        }
    } catch (error) {
        console.error('Wikipedia lookup error:', error)
        return null
    }
}
