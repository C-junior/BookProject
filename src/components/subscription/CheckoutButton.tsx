import { useState } from 'react'
import { auth } from '@/services/firebase'
import { Loader2 } from 'lucide-react'
import './CheckoutButton.css'

interface CheckoutButtonProps {
    targetUrl?: string
    buttonText?: string
}

export function CheckoutButton({ targetUrl, buttonText = 'Subscribe to Pro' }: CheckoutButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleCheckout = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const user = auth.currentUser
            const userId = user?.uid

            if (!user || !userId) {
                // If not logged in, we can't tie a subscription to them.
                throw new Error('You must be logged in to subscribe')
            }

            const token = await user.getIdToken()

            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId, targetUrl })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create checkout session')
            }

            if (data.url) {
                window.location.href = data.url
            } else {
                throw new Error('Invalid response from server')
            }
        } catch (err: any) {
            console.error('Checkout error:', err)
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="checkout-container">
            <button
                onClick={handleCheckout}
                className="checkout-btn"
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="spinner" size={18} />
                        Initializing...
                    </>
                ) : (
                    buttonText
                )}
            </button>
            {error && <p className="checkout-error">{error}</p>}
        </div>
    )
}
