import { useUserStore } from '@/stores/userStore'
import { Check, Sparkles, Monitor, Flower2, Cpu, Cross, Shield } from 'lucide-react'
import type { ReaderPreferences } from '@/types'
import './SkinsView.css'

type SkinId = NonNullable<ReaderPreferences['skin']>

interface SkinOption {
    id: SkinId
    name: string
    blurb: string
    accent: string
    previewClassName: string
    Icon: typeof Monitor
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
        Icon: Cpu
    },
    {
        id: 'synthborne',
        name: 'Synthborne',
        blurb: 'Gold relic energy and sacred circuit drama.',
        accent: 'Signature',
        previewClassName: 'synthborne-preview',
        Icon: Cross
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

export function SkinsView() {
    const { currentUser, updateCurrentUserPreferences } = useUserStore()

    if (!currentUser) return null

    const currentSkin = currentUser.preferences.skin || 'default'

    const handleSelectSkin = async (skin: SkinId) => {
        await updateCurrentUserPreferences({ skin })
    }

    return (
        <div className="skins-view">
            <header className="skins-header">
                <span className="skins-eyebrow">Style Studio</span>
                <h1>App Skins</h1>
                <p>Choose a visual theme — your reading mood, your rules.</p>
            </header>

            <div className="skins-grid">
                {SKIN_OPTIONS.map((skin) => {
                    const isActive = currentSkin === skin.id

                    return (
                        <button
                            key={skin.id}
                            type="button"
                            className={`skin-card ${isActive ? 'active' : ''}`}
                            onClick={() => handleSelectSkin(skin.id)}
                        >
                            <div className={`skin-preview ${skin.previewClassName}`}>
                                <skin.Icon className="skin-icon" />
                                <span className="skin-accent-label">{skin.accent}</span>
                            </div>

                            <div className="skin-info">
                                <div className="skin-title-row">
                                    <h3>{skin.name}</h3>
                                    {isActive && (
                                        <span className="active-badge">
                                            <Check size={13} />
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
        </div>
    )
}
