import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Bookmark } from 'lucide-react'
import type { BookmarkColor } from '@/types'
import './BookmarkCreationModal.css'

interface BookmarkCreationModalProps {
    defaultLabel: string
    /** Initial label for editing */
    initialLabel?: string
    /** Initial color for editing */
    initialColor?: BookmarkColor
    /** Whether this is an edit operation */
    isEditing?: boolean
    onSave: (label: string, color: BookmarkColor) => void
    onCancel: () => void
}

const BOOKMARK_COLORS: { color: BookmarkColor; label: string }[] = [
    { color: 'gold', label: 'Gold' },
    { color: 'teal', label: 'Teal' },
    { color: 'coral', label: 'Coral' },
    { color: 'lavender', label: 'Lavender' },
    { color: 'mint', label: 'Mint' },
    { color: 'rose', label: 'Rose' },
    { color: 'sky', label: 'Sky' },
    { color: 'amber', label: 'Amber' }
]

export function BookmarkCreationModal({
    defaultLabel,
    initialLabel = '',
    initialColor = 'gold',
    isEditing = false,
    onSave,
    onCancel
}: BookmarkCreationModalProps) {
    const [label, setLabel] = useState(initialLabel)
    const [selectedColor, setSelectedColor] = useState<BookmarkColor>(initialColor)
    const inputRef = useRef<HTMLInputElement>(null)
    const modalRef = useRef<HTMLDivElement>(null)

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onCancel])

    // Handle click outside
    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onCancel()
        }
    }, [onCancel])

    const handleSave = useCallback(() => {
        const finalLabel = label.trim() || defaultLabel
        onSave(finalLabel, selectedColor)
    }, [label, selectedColor, defaultLabel, onSave])

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault()
        handleSave()
    }, [handleSave])

    return (
        <div className="bookmark-modal-overlay" onClick={handleOverlayClick}>
            <div className="bookmark-modal" ref={modalRef} role="dialog" aria-modal="true">
                <div className="bookmark-modal-header">
                    <h3 className="bookmark-modal-title">
                        <Bookmark size={20} />
                        {isEditing ? 'Edit Bookmark' : 'Add Bookmark'}
                    </h3>
                    <button
                        className="bookmark-modal-close"
                        onClick={onCancel}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="bookmark-modal-content">
                        {/* Name Input */}
                        <div className="bookmark-modal-field">
                            <label htmlFor="bookmark-label" className="bookmark-modal-label">
                                Name
                            </label>
                            <input
                                ref={inputRef}
                                id="bookmark-label"
                                type="text"
                                className="bookmark-modal-input"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder={defaultLabel}
                                maxLength={50}
                            />
                        </div>

                        {/* Color Selection */}
                        <div className="bookmark-modal-field">
                            <label className="bookmark-modal-label">Color</label>
                            <div className="bookmark-color-palette">
                                {BOOKMARK_COLORS.map(({ color, label: colorLabel }) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`bookmark-color-btn ${selectedColor === color ? 'selected' : ''}`}
                                        style={{ '--bookmark-btn-color': `var(--bookmark-color-${color})` } as React.CSSProperties}
                                        onClick={() => setSelectedColor(color)}
                                        aria-label={colorLabel}
                                        title={colorLabel}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bookmark-modal-actions">
                        <button
                            type="button"
                            className="bookmark-modal-btn bookmark-modal-btn-cancel"
                            onClick={onCancel}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bookmark-modal-btn bookmark-modal-btn-save"
                        >
                            {isEditing ? 'Save Changes' : 'Save Bookmark'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default BookmarkCreationModal

