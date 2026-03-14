import { useUserStore } from '@/stores/userStore'
import { Check, Sparkles, Monitor, Flower2 } from 'lucide-react'
import './SkinsView.css'

export function SkinsView() {
    const { currentUser, updateCurrentUserPreferences } = useUserStore()
    
    if (!currentUser) return null

    const currentSkin = currentUser.preferences.skin || 'default'

    const handleSelectSkin = async (skin: 'default' | 'magic' | 'sakura') => {
        await updateCurrentUserPreferences({ skin })
    }

    return (
        <div className="skins-view">
            <header className="skins-header">
                <h1>App Skins</h1>
                <p>Customize the look and feel of PageTurner</p>
            </header>

            <div className="skins-grid">
                {/* Default Skin */}
                <div 
                    className={`skin-card ${currentSkin === 'default' ? 'active' : ''}`}
                    onClick={() => handleSelectSkin('default')}
                >
                    <div className="skin-preview default-preview">
                        <Monitor className="skin-icon" />
                    </div>
                    <div className="skin-info">
                        <h3>Default</h3>
                        <p>Clean and minimal reading experience</p>
                        {currentSkin === 'default' && (
                            <div className="active-badge">
                                <Check size={14} /> Active
                            </div>
                        )}
                    </div>
                </div>

                {/* Magic Skin */}
                <div 
                    className={`skin-card ${currentSkin === 'magic' ? 'active' : ''}`}
                    onClick={() => handleSelectSkin('magic')}
                >
                    <div className="skin-preview magic-preview">
                        <Sparkles className="skin-icon" />
                    </div>
                    <div className="skin-info">
                        <h3>Magic</h3>
                        <p>Mystical theme with a starry background</p>
                        {currentSkin === 'magic' && (
                            <div className="active-badge">
                                <Check size={14} /> Active
                            </div>
                        )}
                    </div>
                </div>

                <div
                    className={`skin-card ${currentSkin === 'sakura' ? 'active' : ''}`}
                    onClick={() => handleSelectSkin('sakura')}
                >
                    <div className="skin-preview sakura-preview">
                        <Flower2 className="skin-icon" />
                    </div>
                    <div className="skin-info">
                        <h3>Sakura</h3>
                        <p>Soft cherry blossom theme with warm paper and pink accents</p>
                        {currentSkin === 'sakura' && (
                            <div className="active-badge">
                                <Check size={14} /> Active
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
