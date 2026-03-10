import { useState, useEffect } from 'react'
import { Crown, Clock } from 'lucide-react'
import { getUserProfile, getTrialDaysRemaining } from '@/services/firebase'
import { auth } from '@/services/firebase'
import { useUserStore } from '@/stores/userStore'
import { CheckoutButton } from './CheckoutButton'
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

            // If they're a paid subscriber, hide the banner entirely
            if (profile.isPro) {
                setIsPaidPro(true)
                return
            }

            const days = getTrialDaysRemaining(profile)
            setDaysRemaining(days)
        }

        fetchTrialInfo()
    }, [currentUser?.isPro])

    // Don't show for paid Pro users or if dismissed
    if (isPaidPro || dismissed) return null
    // Don't show if we haven't loaded yet
    if (daysRemaining === null) return null

    const isExpired = daysRemaining === 0

    return (
        <div className={`trial-banner ${isExpired ? 'trial-banner--expired' : 'trial-banner--active'}`}>
            <div className="trial-banner-content">
                {isExpired ? (
                    <>
                        <Clock size={18} />
                        <span className="trial-banner-text">
                            Your free trial has ended. Upgrade to Pro for unlimited books and premium features.
                        </span>
                        <CheckoutButton buttonText="Upgrade Now" />
                    </>
                ) : (
                    <>
                        <Crown size={18} />
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
