import { useMemo, useState } from 'react'
import {
    BadgeCheck,
    BookOpen,
    Brush,
    Check,
    Crown,
    ExternalLink,
    Flower2,
    Monitor,
    Shield,
    Sparkles,
    Stars,
    Wand2
} from 'lucide-react'
import { useUserStore } from '@/stores/userStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { parseBookFile } from '@/services/parsers'
import { getActiveUserId } from '@/services/auth/session'
import type { ReaderPreferences } from '@/types'
import './StoreView.css'

type SkinId = NonNullable<ReaderPreferences['skin']>

interface FeaturedBook {
    id: string
    title: string
    author: string
    coverUrl: string
    bookUrl: string
    price: string
    rating: number
    genre: string
    description: string
    websiteUrl: string
    tags: string[]
}

interface SkinOption {
    id: SkinId
    name: string
    blurb: string
    accent: string
    previewClassName: string
    Icon: typeof Monitor
}

const FEATURED_BOOK: FeaturedBook = {
    id: 'chronicles_of_synthborne',
    title: 'Chronicles of Synthborne',
    author: 'Codex Universe',
    coverUrl: 'https://yzdfpjwmtjyzmraifdlh.supabase.co/storage/v1/object/public/books/0Ux5jpiusoOOpmJPNfpaMd7d9mg2/book-1771400697109-ri0nhi12s/cover.jpg',
    bookUrl: 'https://yzdfpjwmtjyzmraifdlh.supabase.co/storage/v1/object/public/books/Chronicles_of_Synthborne.epub',
    price: '$14.99',
    rating: 4.8,
    genre: 'Fantasy / Sci-Fi',
    description: 'A techno-mystic saga with relics, ruins, and enough atmosphere to make the whole app feel bigger than a bookshelf.',
    websiteUrl: 'https://crhonicles-of-synthborn.vercel.app/',
    tags: ['Featured release', 'Immersive world', 'Pairs with themed skins']
}

const SKIN_OPTIONS: SkinOption[] = [
    {
        id: 'default',
        name: 'Default',
        blurb: 'Clean, minimal, and distraction-free.',
        accent: 'Balanced',
        previewClassName: 'default-preview',
        Icon: Monitor
    },
    {
        id: 'magic',
        name: 'Magic',
        blurb: 'Starry, luminous, and a little theatrical.',
        accent: 'Cinematic',
        previewClassName: 'magic-preview',
        Icon: Sparkles
    },
    {
        id: 'sakura',
        name: 'Sakura',
        blurb: 'Warm paper tones with soft blossom color.',
        accent: 'Calm',
        previewClassName: 'sakura-preview',
        Icon: Flower2
    },
    {
        id: 'chronicles',
        name: 'Metal Solid',
        blurb: 'Teal energy, steel texture, ancient-future mood.',
        accent: 'Bold',
        previewClassName: 'chronicles-preview',
        Icon: BadgeCheck
    },
    {
        id: 'synthborne',
        name: 'Synthborne',
        blurb: 'Gold relic energy and sacred circuit drama.',
        accent: 'Signature',
        previewClassName: 'synthborne-preview',
        Icon: Stars
    },
    {
        id: 'samurai',
        name: 'Samurai',
        blurb: 'Wood, parchment, and lacquer-red elegance.',
        accent: 'Grounded',
        previewClassName: 'samurai-preview',
        Icon: Shield
    }
]

export function StoreView() {
    const { currentUser, updateCurrentUserPreferences } = useUserStore()
    const { books, addNewBook } = useLibraryStore()
    const { setActiveTab } = useNavigationStore()
    const [isImportingBook, setIsImportingBook] = useState(false)
    const [bookMessage, setBookMessage] = useState<string | null>(null)
    const [pendingSkin, setPendingSkin] = useState<SkinId | null>(null)

    const activeUserId = getActiveUserId(currentUser?.id)
    const currentSkin = currentUser?.preferences.skin || 'default'
    const isPro = Boolean(currentUser?.isPro)

    const alreadyOwned = useMemo(() => {
        const featuredTitle = FEATURED_BOOK.title.trim().toLowerCase()
        return books.some((book) => book.title.trim().toLowerCase() === featuredTitle)
    }, [books])

    const activeSkinData = SKIN_OPTIONS.find((skin) => skin.id === currentSkin) || SKIN_OPTIONS[0]

    const handleImportFeaturedBook = async () => {
        if (alreadyOwned) {
            setActiveTab('library')
            return
        }

        setIsImportingBook(true)
        setBookMessage(null)

        try {
            const response = await fetch(FEATURED_BOOK.bookUrl)
            if (!response.ok) {
                throw new Error(`Download failed (${response.status})`)
            }

            const blob = await response.blob()
            const file = new File([blob], 'Chronicles_of_Synthborne.epub', { type: blob.type || 'application/epub+zip' })
            const parsedBook = await parseBookFile(file)

            parsedBook.userId = activeUserId
            await addNewBook(parsedBook)

            setBookMessage('Added to your library.')
            setActiveTab('library')
        } catch (error) {
            if (error instanceof Error && error.message === 'BOOK_LIMIT_REACHED') {
                setBookMessage('Free library limit reached. Upgrade to Pro to add more books.')
            } else {
                setBookMessage(error instanceof Error ? error.message : 'Could not add the featured book.')
            }
        } finally {
            setIsImportingBook(false)
        }
    }

    const handleSelectSkin = async (skin: SkinId) => {
        setPendingSkin(skin)
        try {
            await updateCurrentUserPreferences({ skin })
        } finally {
            setPendingSkin(null)
        }
    }

    return (
        <div className="store-view">
            <header className="store-hero">
                <div className="store-hero-copy">
                    <span className="store-eyebrow">Discover</span>
                    <h1>Books and skins that feel connected</h1>
                    <p className="store-subtitle">
                        One place for featured stories and the visual themes that make the app feel like yours.
                    </p>

                    <div className="store-hero-pills">
                        <span className="store-pill">
                            <BookOpen size={14} />
                            Featured release
                        </span>
                        <span className="store-pill">
                            <Brush size={14} />
                            {SKIN_OPTIONS.length} skins ready
                        </span>
                        {isPro && (
                            <span className="store-pill store-pill-pro">
                                <Crown size={14} />
                                Pro unlocked
                            </span>
                        )}
                    </div>
                </div>

                <aside className="store-hero-panel">
                    <p className="store-panel-label">Current look</p>
                    <div className={`store-current-skin-preview ${activeSkinData.previewClassName}`}>
                        <activeSkinData.Icon size={28} />
                    </div>
                    <div className="store-current-skin-copy">
                        <strong>{activeSkinData.name}</strong>
                        <span>{activeSkinData.blurb}</span>
                    </div>
                </aside>
            </header>

            <main className="store-content">
                <section className="store-section store-feature-card">
                    <div className="store-feature-media">
                        <img src={FEATURED_BOOK.coverUrl} alt={FEATURED_BOOK.title} loading="lazy" />
                    </div>

                    <div className="store-feature-body">
                        <div className="store-feature-heading">
                            <span className="store-section-kicker">{FEATURED_BOOK.genre}</span>
                            <h2>{FEATURED_BOOK.title}</h2>
                            <p>by {FEATURED_BOOK.author}</p>
                        </div>

                        <p className="store-feature-description">{FEATURED_BOOK.description}</p>

                        <div className="store-meta-row">
                            <div className="store-rating">
                                <Sparkles size={15} />
                                <span>{FEATURED_BOOK.rating} reader score</span>
                            </div>
                            <div className="store-price">
                                {isPro ? 'Included with Pro' : FEATURED_BOOK.price}
                            </div>
                        </div>

                        <div className="store-tag-row">
                            {FEATURED_BOOK.tags.map((tag) => (
                                <span key={tag} className="store-tag">{tag}</span>
                            ))}
                        </div>

                        <div className="store-action-row">
                            <button
                                type="button"
                                className="store-primary-btn"
                                onClick={handleImportFeaturedBook}
                                disabled={isImportingBook}
                            >
                                {alreadyOwned ? (
                                    <>
                                        <Check size={16} />
                                        Open library
                                    </>
                                ) : isImportingBook ? (
                                    'Adding book...'
                                ) : (
                                    <>
                                        <Wand2 size={16} />
                                        {isPro ? 'Add to library' : 'Get featured book'}
                                    </>
                                )}
                            </button>

                            <a
                                className="store-secondary-btn"
                                href={FEATURED_BOOK.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink size={16} />
                                Explore the world
                            </a>
                        </div>

                        {bookMessage && (
                            <p className="store-inline-message">{bookMessage}</p>
                        )}
                    </div>
                </section>

                <section className="store-section">
                    <div className="store-section-header">
                        <div>
                            <span className="store-section-kicker">Style studio</span>
                            <h2>Choose your app skin</h2>
                        </div>
                        <p>
                            The skin work was already promising. This version makes it feel curated instead of hidden away.
                        </p>
                    </div>

                    <div className="store-skins-grid">
                        {SKIN_OPTIONS.map((skin) => {
                            const isActive = currentSkin === skin.id

                            return (
                                <button
                                    key={skin.id}
                                    type="button"
                                    className={`store-skin-card ${isActive ? 'active' : ''}`}
                                    onClick={() => handleSelectSkin(skin.id)}
                                    disabled={pendingSkin === skin.id}
                                >
                                    <div className={`store-skin-preview ${skin.previewClassName}`}>
                                        <skin.Icon className="store-skin-icon" />
                                        <span className="store-skin-accent">{skin.accent}</span>
                                    </div>

                                    <div className="store-skin-info">
                                        <div className="store-skin-title-row">
                                            <h3>{skin.name}</h3>
                                            {isActive && (
                                                <span className="store-skin-badge">
                                                    <Check size={14} />
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                        <p>{skin.blurb}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </section>
            </main>
        </div>
    )
}
