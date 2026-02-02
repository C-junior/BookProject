import { useState, useCallback, useRef, useEffect } from 'react'
import { useReaderStore } from '@/stores/readerStore'
import { Search, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import type { SearchResult } from '@/types'
import './SearchPanel.css'

interface SearchPanelProps {
    onSearch: (query: string) => Promise<SearchResult[]>
    onNavigate: (cfi: string) => void
}

export function SearchPanel({ onSearch, onNavigate }: SearchPanelProps) {
    const { toggleSearch, searchQuery, searchResults, setSearchQuery, setSearchResults } = useReaderStore()

    const [isSearching, setIsSearching] = useState(false)
    const [currentIndex, setCurrentIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // Perform search
    const handleSearch = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()

        if (!searchQuery.trim()) {
            setSearchResults([])
            return
        }

        setIsSearching(true)
        setCurrentIndex(0)

        try {
            const results = await onSearch(searchQuery)
            setSearchResults(results)

            // Navigate to first result if any
            if (results.length > 0) {
                onNavigate(results[0].cfi)
            }
        } catch (err) {
            console.error('Search failed:', err)
            setSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }, [searchQuery, onSearch, onNavigate, setSearchResults])

    // Navigate to next result
    const handleNext = useCallback(() => {
        if (searchResults.length === 0) return

        const nextIndex = (currentIndex + 1) % searchResults.length
        setCurrentIndex(nextIndex)
        onNavigate(searchResults[nextIndex].cfi)
    }, [currentIndex, searchResults, onNavigate])

    // Navigate to previous result
    const handlePrev = useCallback(() => {
        if (searchResults.length === 0) return

        const prevIndex = currentIndex === 0 ? searchResults.length - 1 : currentIndex - 1
        setCurrentIndex(prevIndex)
        onNavigate(searchResults[prevIndex].cfi)
    }, [currentIndex, searchResults, onNavigate])

    // Navigate to specific result
    const handleSelectResult = useCallback((index: number) => {
        setCurrentIndex(index)
        onNavigate(searchResults[index].cfi)
    }, [searchResults, onNavigate])

    // Clear search
    const handleClear = useCallback(() => {
        setSearchQuery('')
        setSearchResults([])
        setCurrentIndex(0)
        inputRef.current?.focus()
    }, [setSearchQuery, setSearchResults])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                toggleSearch()
            } else if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault()
                handlePrev()
            } else if (e.key === 'Enter' && !e.shiftKey && searchResults.length > 0) {
                e.preventDefault()
                handleNext()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [toggleSearch, handleNext, handlePrev, searchResults.length])

    return (
        <div className="search-panel">
            {/* Search Header */}
            <div className="search-header">
                <form onSubmit={handleSearch} className="search-form">
                    <div className="search-input-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search in book..."
                            className="search-input"
                            autoComplete="off"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="search-clear"
                                onClick={handleClear}
                                aria-label="Clear search"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="search-submit"
                        disabled={isSearching || !searchQuery.trim()}
                    >
                        {isSearching ? <Loader2 size={18} className="search-spinner" /> : 'Find'}
                    </button>
                </form>

                <button
                    className="search-close"
                    onClick={toggleSearch}
                    aria-label="Close search"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Results Navigation */}
            {searchResults.length > 0 && (
                <div className="search-navigation">
                    <span className="search-count">
                        {currentIndex + 1} of {searchResults.length} results
                    </span>
                    <div className="search-nav-buttons">
                        <button onClick={handlePrev} aria-label="Previous result">
                            <ChevronUp size={18} />
                        </button>
                        <button onClick={handleNext} aria-label="Next result">
                            <ChevronDown size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Results List */}
            <div className="search-results">
                {isSearching ? (
                    <div className="search-loading">
                        <Loader2 size={24} className="search-spinner" />
                        <span>Searching...</span>
                    </div>
                ) : searchResults.length === 0 && searchQuery ? (
                    <div className="search-no-results">
                        <p>No results found for "{searchQuery}"</p>
                        <span>Try different keywords</span>
                    </div>
                ) : (
                    <ul className="search-results-list">
                        {searchResults.map((result, index) => (
                            <li key={result.cfi}>
                                <button
                                    className={`search-result-item ${index === currentIndex ? 'active' : ''}`}
                                    onClick={() => handleSelectResult(index)}
                                >
                                    <span className="search-result-chapter">{result.chapter}</span>
                                    <span
                                        className="search-result-excerpt"
                                        dangerouslySetInnerHTML={{
                                            __html: highlightQuery(result.excerpt, searchQuery)
                                        }}
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

// Highlight search query in excerpt
function highlightQuery(text: string, query: string): string {
    if (!query) return text

    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
}

// Escape regex special characters
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default SearchPanel
