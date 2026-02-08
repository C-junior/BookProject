import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { Collection, Book } from '@/types'
import './CollectionPicker.css'

interface CollectionPickerProps {
    book: Book
    collections: Collection[]
    onSelect: (collectionId: string) => Promise<void>
    onClose: () => void
}

export function CollectionPicker({ book, collections, onSelect, onClose }: CollectionPickerProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const handleSelect = async (collectionId: string) => {
        setIsLoading(true)
        setSelectedId(collectionId)
        try {
            await onSelect(collectionId)
            onClose()
        } catch (err) {
            console.error('Failed to add to collection:', err)
        } finally {
            setIsLoading(false)
            setSelectedId(null)
        }
    }

    // Check if book is already in a collection
    const isInCollection = (collectionId: string) => {
        return book.collectionIds?.includes(collectionId) ?? false
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Add to Collection"
            size="sm"
        >
            <div className="collection-picker">
                <p className="collection-picker-subtitle">
                    Select a collection for <strong>{book.title}</strong>
                </p>

                {collections.length === 0 ? (
                    <div className="collection-picker-empty">
                        <p>No collections yet. Create one first!</p>
                    </div>
                ) : (
                    <div className="collection-picker-list">
                        {collections.map((col) => (
                            <button
                                key={col.id}
                                className={`collection-picker-item ${isInCollection(col.id) ? 'in-collection' : ''}`}
                                onClick={() => handleSelect(col.id)}
                                disabled={isLoading || isInCollection(col.id)}
                            >
                                <span
                                    className="collection-picker-color"
                                    style={{ backgroundColor: col.color }}
                                />
                                <span className="collection-picker-name">{col.name}</span>
                                {isInCollection(col.id) && (
                                    <Check size={16} className="collection-picker-check" />
                                )}
                                {selectedId === col.id && isLoading && (
                                    <span className="collection-picker-loading">...</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                <button className="collection-picker-cancel" onClick={onClose}>
                    <X size={16} />
                    Cancel
                </button>
            </div>
        </Modal>
    )
}

export default CollectionPicker
