import { Library, ShoppingBag, Settings, Palette } from 'lucide-react'
import { useNavigationStore } from '@/stores/navigationStore'
import { useTranslation } from 'react-i18next'
import './BottomNav.css'

export function BottomNav() {
    const { activeTab, setActiveTab } = useNavigationStore()
    const { t } = useTranslation()

    return (
        <nav className="bottom-nav">
            <div className="bottom-nav-container">
                <button
                    className={`bottom-nav-item ${activeTab === 'library' ? 'active' : ''}`}
                    onClick={() => setActiveTab('library')}
                    aria-label={t('nav.library') || 'Library'}
                >
                    <Library size={24} />
                    <span className="bottom-nav-label">Library</span>
                </button>
                
                <button
                    className={`bottom-nav-item ${activeTab === 'store' ? 'active' : ''}`}
                    onClick={() => setActiveTab('store')}
                    aria-label={t('nav.store') || 'Store'}
                >
                    <ShoppingBag size={24} />
                    <span className="bottom-nav-label">Store</span>
                </button>

                <button
                    className={`bottom-nav-item ${activeTab === 'skins' ? 'active' : ''}`}
                    onClick={() => setActiveTab('skins')}
                    aria-label={t('nav.skins') || 'Skins'}
                >
                    <Palette size={24} />
                    <span className="bottom-nav-label">Skins</span>
                </button>

                <button
                    className={`bottom-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                    aria-label={t('nav.settings') || 'Settings'}
                >
                    <Settings size={24} />
                    <span className="bottom-nav-label">Settings</span>
                </button>
            </div>
        </nav>
    )
}
