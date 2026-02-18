import { useState, useEffect } from 'react'
import { X, Loader2, BookOpen, AlertCircle } from 'lucide-react'
import { fetchDefinition, type DictionaryDefinition } from '@/services/dictionary'
import './DictionaryModal.css'

interface DictionaryModalProps {
    word: string
    onClose: () => void
}

export function DictionaryModal({ word, onClose }: DictionaryModalProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [definition, setDefinition] = useState<DictionaryDefinition | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)
            setError(null)

            try {
                const defResult = await fetchDefinition(word)
                setDefinition(defResult)
            } catch {
                setError('Falha ao buscar definicao')
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

                <div className="dictionary-modal-content">
                    {isLoading ? (
                        <div className="dictionary-loading">
                            <Loader2 size={32} className="dictionary-loading-spinner" />
                            <span>Buscando "{word}"...</span>
                        </div>
                    ) : error ? (
                        <div className="dictionary-error">
                            <AlertCircle size={40} className="dictionary-error-icon" />
                            <p>{error}</p>
                        </div>
                    ) : definition ? (
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
                            <p>Nao foi encontrada definicao em portugues para "{word}"</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default DictionaryModal
