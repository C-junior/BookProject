import { useState, useEffect } from 'react'
import { Crown, Clock } from 'lucide-react'
import { getUserProfile, getTrialDaysRemaining } from '@/services/firebase'
import { auth } from '@/services/firebase'
import { useUserStore } from '@/stores/userStore'
import './TrialBanner.css'

export function TrialBanner() {
    const currentUser = useUserStore(s => s.currentUser)
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
    const [isPaidPro, setIsPaidPro] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        const fetchTrialInfo = async () => {
            const uid = auth.currentUser?.uid
            if (!uid) return

            const profile = await getUserProfile(uid)
            if (!profile) return

            if (profile.isPro) {
                setIsPaidPro(true)
                return
            }

            const days = getTrialDaysRemaining(profile)
            setDaysRemaining(days)
        }

        fetchTrialInfo()
    }, [currentUser?.isPro])

    if (isPaidPro || dismissed) return null
    if (daysRemaining === null) return null

    const isExpired = daysRemaining === 0

    const handleUpgrade = async () => {
        const userId = auth.currentUser?.uid
        if (!userId) return

        try {
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            })
            const data = await response.json()
            if (data.url) {
                window.location.href = data.url
            }
        } catch (err) {
            console.error('Failed to start checkout:', err)
        }
    }

    return (
        <div className={`trial-banner ${isExpired ? 'trial-banner--expired' : 'trial-banner--active'}`}>
            <div className="trial-banner-content">
                {isExpired ? (
                    <>
                        <Clock size={16} />
                        <span className="trial-banner-text">
                            Your free trial has ended. Upgrade for unlimited books.
                        </span>
                        <div className="trial-banner-actions">
                            <button className="trial-banner-upgrade-btn" onClick={handleUpgrade}>
                                Upgrade Now
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <Crown size={16} />
                        <span className="trial-banner-text">
                            <strong>Pro Trial</strong> — {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                        </span>
                        <button className="trial-banner-dismiss" onClick={() => setDismissed(true)}>
                            ✕
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
