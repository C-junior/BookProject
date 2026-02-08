import { useState, useEffect } from 'react'
import { X, Loader2, BookOpen, ExternalLink, AlertCircle } from 'lucide-react'
import { fetchDefinition, fetchWikipediaSummary, type DictionaryDefinition, type WikipediaSummary } from '@/services/dictionary'
import './DictionaryModal.css'

interface DictionaryModalProps {
    word: string
    onClose: () => void
}

type TabType = 'dictionary' | 'wikipedia'

export function DictionaryModal({ word, onClose }: DictionaryModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('dictionary')
    const [isLoading, setIsLoading] = useState(true)
    const [definition, setDefinition] = useState<DictionaryDefinition | null>(null)
    const [wikipedia, setWikipedia] = useState<WikipediaSummary | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)
            setError(null)

            try {
                // Fetch both in parallel
                const [defResult, wikiResult] = await Promise.all([
                    fetchDefinition(word),
                    fetchWikipediaSummary(word)
                ])

                setDefinition(defResult)
                setWikipedia(wikiResult)

                // If dictionary has no result, switch to Wikipedia tab
                if (!defResult && wikiResult) {
                    setActiveTab('wikipedia')
                }
            } catch (err) {
                setError('Failed to fetch information')
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [word])

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div className="dictionary-modal-overlay" onClick={handleBackdropClick}>
            <div className="dictionary-modal">
                {/* Header */}
                <header className="dictionary-modal-header">
                    <div>
                        <h2 className="dictionary-modal-word">{word}</h2>
                        {definition?.phonetic && (
                            <span className="dictionary-modal-phonetic">{definition.phonetic}</span>
                        )}
                    </div>
                    <button
                        className="dictionary-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </header>

                {/* Tabs */}
                <div className="dictionary-modal-tabs">
                    <button
                        className={`dictionary-modal-tab ${activeTab === 'dictionary' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dictionary')}
                    >
                        📖 Dictionary
                    </button>
                    <button
                        className={`dictionary-modal-tab ${activeTab === 'wikipedia' ? 'active' : ''}`}
                        onClick={() => setActiveTab('wikipedia')}
                    >
                        🌐 Wikipedia
                    </button>
                </div>

                {/* Content */}
                <div className="dictionary-modal-content">
                    {isLoading ? (
                        <div className="dictionary-loading">
                            <Loader2 size={32} className="dictionary-loading-spinner" />
                            <span>Looking up "{word}"...</span>
                        </div>
                    ) : error ? (
                        <div className="dictionary-error">
                            <AlertCircle size={40} className="dictionary-error-icon" />
                            <p>{error}</p>
                        </div>
                    ) : activeTab === 'dictionary' ? (
                        definition ? (
                            <div className="dictionary-meanings">
                                {definition.meanings.map((meaning, idx) => (
                                    <div key={idx} className="dictionary-meaning">
                                        <div className="dictionary-pos">{meaning.partOfSpeech}</div>
                                        <ol className="dictionary-definitions">
                                            {meaning.definitions.map((def, defIdx) => (
                                                <li key={defIdx} className="dictionary-definition">
                                                    {def.definition}
                                                    {def.example && (
                                                        <p className="dictionary-example">"{def.example}"</p>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="dictionary-error">
                                <BookOpen size={40} className="dictionary-error-icon" />
                                <p>No definition found for "{word}"</p>
                                <p>Try the Wikipedia tab for more information.</p>
                            </div>
                        )
                    ) : (
                        wikipedia ? (
                            <div className="wikipedia-content">
                                {wikipedia.thumbnail && (
                                    <img
                                        src={wikipedia.thumbnail.source}
                                        alt={wikipedia.title}
                                        className="wikipedia-thumbnail"
                                    />
                                )}
                                <p className="wikipedia-extract">{wikipedia.extract}</p>
                                <a
                                    href={wikipedia.pageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="wikipedia-link"
                                >
                                    Read more on Wikipedia
                                    <ExternalLink size={14} />
                                </a>
                            </div>
                        ) : (
                            <div className="dictionary-error">
                                <AlertCircle size={40} className="dictionary-error-icon" />
                                <p>No Wikipedia article found for "{word}"</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}

export default DictionaryModal
