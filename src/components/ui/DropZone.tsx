import React, { useCallback } from 'react'
import { Upload, FolderOpen } from 'lucide-react'
import './DropZone.css'

interface DropZoneProps {
    onFilesSelected: (files: FileList) => void
    accept?: string
    multiple?: boolean
    disabled?: boolean
    children?: React.ReactNode
}

export function DropZone({
    onFilesSelected,
    accept = '.epub,.pdf,.mobi,.txt,.html',
    multiple = true,
    disabled = false,
    children
}: DropZoneProps) {
    const [isDragging, setIsDragging] = React.useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) {
            setIsDragging(true)
        }
    }, [disabled])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        if (disabled) return

        const files = e.dataTransfer.files
        if (files.length > 0) {
            onFilesSelected(files)
        }
    }, [disabled, onFilesSelected])

    const handleClick = useCallback(() => {
        if (!disabled) {
            fileInputRef.current?.click()
        }
    }, [disabled])

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            onFilesSelected(files)
        }
        // Reset input so same file can be selected again
        e.target.value = ''
    }, [onFilesSelected])

    return (
        <div
            className={`
        dropzone
        ${isDragging ? 'dropzone-active' : ''}
        ${disabled ? 'dropzone-disabled' : ''}
      `.trim()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleClick()
                }
            }}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                onChange={handleFileChange}
                className="dropzone-input"
                tabIndex={-1}
            />

            {children || (
                <div className="dropzone-content">
                    <div className="dropzone-icon">
                        {isDragging ? <FolderOpen size={48} /> : <Upload size={48} />}
                    </div>
                    <div className="dropzone-text">
                        <span className="dropzone-title">
                            {isDragging ? 'Drop your books here' : 'Drag & drop books here'}
                        </span>
                        <span className="dropzone-subtitle">
                            or click to browse files
                        </span>
                    </div>
                    <div className="dropzone-formats">
                        Supports: EPUB, PDF, TXT, HTML
                    </div>
                </div>
            )}
        </div>
    )
}

export default DropZone
