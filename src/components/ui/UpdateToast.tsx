import { useState, useEffect, useCallback } from 'react'
import './UpdateToast.css'

interface UpdateToastProps {
    onUpdate: () => void
}

export function UpdateToast({ onUpdate }: UpdateToastProps) {
    const [visible, setVisible] = useState(true)
    const [dismissing, setDismissing] = useState(false)

    const handleDismiss = useCallback(() => {
        setDismissing(true)
        setTimeout(() => setVisible(false), 300)
    }, [])

    // Auto-dismiss after 15 seconds
    useEffect(() => {
        const timer = setTimeout(handleDismiss, 15000)
        return () => clearTimeout(timer)
    }, [handleDismiss])

    if (!visible) return null

    return (
        <div className={`update-toast ${dismissing ? 'update-toast--dismissing' : ''}`} role="alert">
            <div className="update-toast__content">
                <div className="update-toast__icon">✨</div>
                <div className="update-toast__text">
                    <strong>Update available</strong>
                    <span>A new version of Codex is ready</span>
                </div>
            </div>
            <div className="update-toast__actions">
                <button className="update-toast__btn update-toast__btn--later" onClick={handleDismiss}>
                    Later
                </button>
                <button className="update-toast__btn update-toast__btn--update" onClick={onUpdate}>
                    Update Now
                </button>
            </div>
        </div>
    )
}
