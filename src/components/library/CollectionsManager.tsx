import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { Collection } from '@/types'
import './CollectionsManager.css'

interface CollectionsManagerProps {
    collections: Collection[]
    onCreateCollection: (name: string, color: string) => Promise<void>
    onDeleteCollection: (id: string) => Promise<void>
    onClose: () => void
}

const PRESET_COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#38a3a5', // teal
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
]

export function CollectionsManager({
    collections,
    onCreateCollection,
    onDeleteCollection,
    onClose
}: CollectionsManagerProps) {
    const [isCreating, setIsCreating] = useState(false)
    const [newName, setNewName] = useState('')
    const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0])
    const [isLoading, setIsLoading] = useState(false)

    const handleCreate = async () => {
        if (!newName.trim()) return

        setIsLoading(true)
        try {
            await onCreateCollection(newName.trim(), selectedColor)
            setNewName('')
            setIsCreating(false)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this collection? Books will not be removed.')) return

        setIsLoading(true)
        try {
            await onDeleteCollection(id)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Manage Collections"
            size="md"
        >
            <div className="collections-manager">
                {/* Existing collections */}
                <div className="collections-list">
                    {collections.length === 0 ? (
                        <p className="collections-empty">
                            No collections yet. Create your first one!
                        </p>
                    ) : (
                        collections.map((col) => (
                            <div key={col.id} className="collection-item">
                                <span
                                    className="collection-color"
                                    style={{ backgroundColor: col.color }}
                                />
                                <span className="collection-name">{col.name}</span>
                                <button
                                    className="collection-delete"
                                    onClick={() => handleDelete(col.id)}
                                    disabled={isLoading}
                                    aria-label={`Delete ${col.name}`}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Create new collection form */}
                {isCreating ? (
                    <div className="collection-create-form">
                        <input
                            type="text"
                            className="collection-input"
                            placeholder="Collection name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            autoFocus
                        />
                        <div className="collection-color-picker">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    className={`collection-color-option ${selectedColor === color ? 'selected' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setSelectedColor(color)}
                                    aria-label={`Select color ${color}`}
                                />
                            ))}
                        </div>
                        <div className="collection-form-actions">
                            <Button
                                variant="secondary"
                                onClick={() => setIsCreating(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleCreate}
                                disabled={!newName.trim() || isLoading}
                            >
                                Create
                            </Button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="collection-add-btn"
                        onClick={() => setIsCreating(true)}
                    >
                        <Plus size={18} />
                        New Collection
                    </button>
                )}
            </div>
        </Modal>
    )
}

export default CollectionsManager
