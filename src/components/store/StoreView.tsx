import { ShoppingBag, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './StoreView.css'

interface MockBook {
    id: string
    title: string
    author: string
    coverUrl: string
    price: string
    rating: number
    genre: string
}

const MOCK_BOOKS: MockBook[] = [
    {
        id: '1',
        title: 'The Design of Everyday Things',
        author: 'Don Norman',
        coverUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400',
        price: '$14.99',
        rating: 4.8,
        genre: 'Design'
    },
    {
        id: '2',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        coverUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=400',
        price: '$29.99',
        rating: 4.9,
        genre: 'Programming'
    },
    {
        id: '3',
        title: 'Dune',
        author: 'Frank Herbert',
        coverUrl: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=400',
        price: '$9.99',
        rating: 4.7,
        genre: 'Sci-Fi'
    },
    {
        id: '4',
        title: 'Atomic Habits',
        author: 'James Clear',
        coverUrl: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=400',
        price: '$11.99',
        rating: 4.9,
        genre: 'Self-Help'
    }
]

export function StoreView() {
    const { t } = useTranslation()

    const handleGetBook = (book: MockBook) => {
        // Mock interaction
        alert(`Interaction placeholder: Getting "${book.title}"`)
    }

    return (
        <div className="store-view">
            <header className="store-header">
                <h1>{t('store.title') || 'Store'}</h1>
                <p className="store-subtitle">Discover your next great read</p>
            </header>

            <div className="store-grid">
                {MOCK_BOOKS.map(book => (
                    <div key={book.id} className="store-book-card">
                        <div className="store-book-cover">
                            <img src={book.coverUrl} alt={book.title} loading="lazy" />
                            <div className="store-book-genre">{book.genre}</div>
                        </div>
                        <div className="store-book-info">
                            <h3 className="store-book-title">{book.title}</h3>
                            <p className="store-book-author">{book.author}</p>
                            
                            <div className="store-book-meta">
                                <div className="store-book-rating">
                                    <Star size={14} className="star-icon" />
                                    <span>{book.rating}</span>
                                </div>
                                <div className="store-book-price">
                                    {book.price}
                                </div>
                            </div>

                            <button 
                                className="store-get-btn"
                                onClick={() => handleGetBook(book)}
                            >
                                <ShoppingBag size={16} />
                                <span>Get</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
