import { Library, Settings, Sparkles } from 'lucide-react'
import { useNavigationStore } from '@/stores/navigationStore'
import './BottomNav.css'

export function BottomNav() {
    const { activeTab, setActiveTab } = useNavigationStore()

    return (
        <nav className="bottom-nav">
            <div className="bottom-nav-container">
                <button
                    className={`bottom-nav-item ${activeTab === 'library' ? 'active' : ''}`}
                    onClick={() => setActiveTab('library')}
                    aria-label="Library"
                >
                    <Library size={24} />
                    <span className="bottom-nav-label">Library</span>
                </button>
                
                <button
                    className={`bottom-nav-item ${(activeTab === 'store' || activeTab === 'skins') ? 'active' : ''}`}
                    onClick={() => setActiveTab('store')}
                    aria-label="Discover"
                >
                    <Sparkles size={24} />
                    <span className="bottom-nav-label">Discover</span>
                </button>

                <button
                    className={`bottom-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                    aria-label="Settings"
                >
                    <Settings size={24} />
                    <span className="bottom-nav-label">Settings</span>
                </button>
            </div>
        </nav>
    )
}
