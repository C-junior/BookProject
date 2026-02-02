import { useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import type { HighlightColor } from '@/types'
import './HighlightMenu.css'

interface HighlightMenuProps {
    onHighlight: (color: HighlightColor) => void
    onClose: () => void
    position: { x: number; y: number } | null
}

const COLORS: { value: HighlightColor; label: string; color: string }[] = [
    { value: 'yellow', label: 'Yellow', color: '#ffeb3b' },
    { value: 'green', label: 'Green', color: '#a5d6a7' },
    { value: 'blue', label: 'Blue', color: '#90caf9' },
    { value: 'pink', label: 'Pink', color: '#f48fb1' },
    { value: 'orange', label: 'Orange', color: '#ffcc80' }
]

export function HighlightMenu({ onHighlight, onClose, position }: HighlightMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    if (!position) return null

    return (
        <div
            className="highlight-menu"
            ref={menuRef}
            style={{
                top: position.y,
                left: position.x
            }}
        >
            <div className="highlight-colors">
                {COLORS.map((c) => (
                    <button
                        key={c.value}
                        className="highlight-color-btn"
                        style={{ backgroundColor: c.color }}
                        onClick={() => onHighlight(c.value)}
                        aria-label={`Highlight ${c.label}`}
                    />
                ))}
            </div>

            <div className="highlight-actions">
                <button className="highlight-action-btn" onClick={onClose} aria-label="Cancel">
                    <X size={16} />
                </button>
            </div>

            {/* Note and Copy features can be added in future iterations
            <div className="highlight-actions">
                <button className="highlight-action-btn" aria-label="Add Note">
                    <MessageSquare size={16} />
                </button>
                <button className="highlight-action-btn" aria-label="Copy Text">
                    <Copy size={16} />
                </button>
            </div>
            */}
        </div>
    )
}
