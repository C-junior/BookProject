import { ShoppingBag, Star, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '@/stores/userStore'
import './StoreView.css'

interface StoreBook {
    id: string
    title: string
    author: string
    coverUrl: string
    bookUrl: string
    price: string
    rating: number
    genre: string
}

const STORE_BOOK: StoreBook = {
    id: 'chronicles_of_synthborne',
    title: 'Chronicles of Synthborne',
    author: 'Unknown',
    coverUrl: 'https://yzdfpjwmtjyzmraifdlh.supabase.co/storage/v1/object/public/books/0Ux5jpiusoOOpmJPNfpaMd7d9mg2/book-1771400697109-ri0nhi12s/cover.jpg',
    bookUrl: 'https://yzdfpjwmtjyzmraifdlh.supabase.co/storage/v1/object/public/books/Chronicles_of_Synthborne.epub',
    price: '$14.99',
    rating: 4.8,
    genre: 'Fantasy/Sci-Fi'
}

export function StoreView() {
    const { t } = useTranslation()
    const { currentUser } = useUserStore()

    const isPro = Boolean(currentUser?.isPro)

    const handleGetBook = (book: StoreBook) => {
        if (isPro) {
            alert(`Interaction placeholder: Downloading/Adding "${book.title}" to library. (Pro user)`)
        } else {
            alert(`Interaction placeholder: Redirecting to purchase flow for "${book.title}" ($14.99).`)
        }
    }

    return (
        <div className="store-view">
            <header className="store-header">
                <h1>{t('store.title') || 'Store'}</h1>
                <p className="store-subtitle">Discover your next great read</p>
            </header>

            <div className="store-grid">
                <div key={STORE_BOOK.id} className="store-book-card">
                    <div className="store-book-cover">
                        <img src={STORE_BOOK.coverUrl} alt={STORE_BOOK.title} loading="lazy" />
                        <div className="store-book-genre">{STORE_BOOK.genre}</div>
                    </div>
                    <div className="store-book-info">
                        <h3 className="store-book-title">{STORE_BOOK.title}</h3>
                        <p className="store-book-author">{STORE_BOOK.author}</p>
                        
                        <div className="store-book-meta">
                            <div className="store-book-rating">
                                <Star size={14} className="star-icon" />
                                <span>{STORE_BOOK.rating}</span>
                            </div>
                            <div className="store-book-price">
                                {isPro ? 'Included with Pro' : STORE_BOOK.price}
                            </div>
                        </div>

                        <button 
                            className="store-get-btn"
                            onClick={() => handleGetBook(STORE_BOOK)}
                        >
                            {isPro ? <Download size={16} /> : <ShoppingBag size={16} />}
                            <span>{isPro ? 'Get' : 'Buy'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
