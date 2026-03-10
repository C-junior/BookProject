import { X, Crown, BookOpen } from 'lucide-react'
import { CheckoutButton } from './CheckoutButton'
import { FREE_BOOK_LIMIT } from '@/stores/libraryStore'
import './UpgradePrompt.css'

interface UpgradePromptProps {
    onClose: () => void
    reason?: 'book_limit' | 'premium_book'
}

export function UpgradePrompt({ onClose, reason = 'book_limit' }: UpgradePromptProps) {
    return (
        <div className="upgrade-overlay" onClick={onClose}>
            <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
                <button className="upgrade-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="upgrade-icon">
                    <Crown size={40} />
                </div>

                <h2 className="upgrade-title">Upgrade to Pro</h2>

                {reason === 'book_limit' ? (
                    <p className="upgrade-desc">
                        You've reached the free limit of <strong>{FREE_BOOK_LIMIT} books</strong>.
                        Upgrade to Pro for unlimited books, cloud sync, and more.
                    </p>
                ) : (
                    <p className="upgrade-desc">
                        This book requires a <strong>Pro subscription</strong>.
                        Upgrade to unlock premium content and unlimited reading.
                    </p>
                )}

                <div className="upgrade-features">
                    <div className="upgrade-feature">
                        <BookOpen size={16} />
                        <span>Unlimited books</span>
                    </div>
                    <div className="upgrade-feature">
                        <Crown size={16} />
                        <span>Premium content access</span>
                    </div>
                </div>

                <CheckoutButton buttonText="Subscribe to Pro" />

                <button className="upgrade-dismiss" onClick={onClose}>
                    Maybe later
                </button>
            </div>
        </div>
    )
}
