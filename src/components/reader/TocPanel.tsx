import type { TocItem } from '@/types'
import { useReaderStore } from '@/stores/readerStore'
import { X, ChevronRight } from 'lucide-react'
import './TocPanel.css'

interface TocPanelProps {
    toc: TocItem[]
    onSelect: (href: string) => void
}

export function TocPanel({ toc, onSelect }: TocPanelProps) {
    const { toggleToc } = useReaderStore()

    const handleSelect = (href: string) => {
        onSelect(href)
        toggleToc()
    }

    const renderItem = (item: TocItem) => (
        <li key={item.id} className="toc-item">
            <button
                className="toc-link"
                onClick={() => handleSelect(item.href)}
                style={{ paddingLeft: `${16 + item.level * 16}px` }}
            >
                <span className="toc-label">{item.label}</span>
                <ChevronRight size={16} className="toc-arrow" />
            </button>
            {item.children && item.children.length > 0 && (
                <ul className="toc-sublist">
                    {item.children.map(renderItem)}
                </ul>
            )}
        </li>
    )

    return (
        <div className="toc-panel">
            <div className="toc-panel-content">
                {/* Header */}
                <div className="toc-header">
                    <h2 className="toc-title">Table of Contents</h2>
                    <button
                        className="toc-close"
                        onClick={toggleToc}
                        aria-label="Close table of contents"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* TOC List */}
                <nav className="toc-nav" aria-label="Table of contents">
                    {toc.length === 0 ? (
                        <p className="toc-empty">No table of contents available</p>
                    ) : (
                        <ul className="toc-list">
                            {toc.map(renderItem)}
                        </ul>
                    )}
                </nav>
            </div>
        </div>
    )
}

export default TocPanel
