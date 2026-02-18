/**
 * Portuguese Dictionary Lookup Service
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

/**
 * Fetch word definition from Free Dictionary API (Portuguese only).
 * If Portuguese is not available, returns null (no English fallback).
 */
export async function fetchDefinition(word: string): Promise<DictionaryDefinition | null> {
    try {
        const cleanWord = word.trim().toLowerCase().split(/\s+/)[0]
        const response = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/pt/${encodeURIComponent(cleanWord)}`
        )

        if (!response.ok) {
            if (response.status === 404) return null
            throw new Error('Portuguese dictionary lookup failed')
        }

        const data = await response.json()
        const entry = data[0]
        if (!entry || !Array.isArray(entry.meanings) || entry.meanings.length === 0) {
            return null
        }

        return {
            word: entry.word || cleanWord,
            phonetic: entry.phonetic || entry.phonetics?.[0]?.text,
            meanings: entry.meanings.map((m: any) => ({
                partOfSpeech: m.partOfSpeech || 'classe gramatical',
                definitions: (m.definitions || []).slice(0, 3).map((d: any) => ({
                    definition: d.definition,
                    example: d.example
                }))
            }))
        }
    } catch (error) {
        console.error('Portuguese dictionary lookup error:', error)
        return null
    }
}
