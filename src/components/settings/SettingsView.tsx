import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Crown, LogOut, Globe, RotateCcw, Palette, BarChart3,
    LayoutGrid, List, FolderOpen, Cloud, HardDrive, Trash2,
    Monitor, Info, RefreshCw, ChevronRight, Image as ImageIcon,
    Loader2, ExternalLink
} from 'lucide-react'
import { useUserStore } from '@/stores/userStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSyncStore } from '@/stores/syncStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { updateBook } from '@/services/storage/db'
import { auth, getStripeCustomerId } from '@/services/firebase'
import './SettingsView.css'

interface SettingsViewProps {
    onLogout: () => void
}

const APP_VERSION = '1.0.0'

type ConfirmAction = 'signout' | 'clear-downloads' | 'reset-settings' | null

export function SettingsView({ onLogout }: SettingsViewProps) {
    const { t, i18n } = useTranslation()
    const { currentUser, updateCurrentUserPreferences } = useUserStore()
    const { books, sortBy, setSortBy, viewMode, setViewMode } = useLibraryStore()
    const { keepScreenAwake, setKeepScreenAwake } = useSettingsStore()
    const { isSyncing, lastSyncTime, isOnline } = useSyncStore()
    const { setActiveTab } = useNavigationStore()

    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
    const [toast, setToast] = useState<string | null>(null)
    const [portalLoading, setPortalLoading] = useState(false)
    const [hasStripeCustomer, setHasStripeCustomer] = useState(false)

    const isPro = currentUser?.isPro ?? false
    const userName = currentUser?.name || 'Reader'
    const userInitial = userName.charAt(0).toUpperCase()

    // Check if user has a Stripe customer ID (for showing Manage vs Upgrade)
    useEffect(() => {
        const uid = auth.currentUser?.uid
        if (uid && isPro) {
            getStripeCustomerId(uid).then(id => setHasStripeCustomer(!!id))
        }
    }, [isPro])

    const downloadedCount = useMemo(
        () => books.filter(b => b.fileBlob && !b.isCloudOnly).length,
        [books]
    )

    const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

    const showToast = useCallback((message: string) => {
        setToast(message)
        setTimeout(() => setToast(null), 2500)
    }, [])

    const handleLanguageChange = (lang: string) => {
        i18n.changeLanguage(lang)
    }

    const handleReplayOnboarding = async () => {
        await updateCurrentUserPreferences({ hasCompletedOnboarding: false })
        showToast(t('appSettings.onboardingReset'))
    }

    const handleViewModeChange = (mode: 'grid' | 'list') => {
        setViewMode(mode)
    }

    const handleSortChange = (value: string) => {
        setSortBy(value as 'title' | 'author' | 'addedAt' | 'lastReadAt')
    }

    const handleClearDownloads = async () => {
        const booksWithBlobs = books.filter(b => b.fileBlob)
        for (const book of booksWithBlobs) {
            await updateBook(book.id, { fileBlob: undefined, isCloudOnly: true })
        }
        useLibraryStore.setState(state => ({
            books: state.books.map(b =>
                b.fileBlob ? { ...b, fileBlob: undefined, isCloudOnly: true } : b
            )
        }))
        setConfirmAction(null)
        showToast(t('appSettings.clearLocalDownloadsSuccess'))
    }

    const handleResetAllSettings = async () => {
        setViewMode('grid')
        setSortBy('lastReadAt')
        await setKeepScreenAwake(false)
        await updateCurrentUserPreferences({
            theme: 'light',
            skin: 'default',
            fontFamily: 'Literata',
            fontSize: 18,
            lineHeight: 1.6,
            margins: 40,
            textAlign: 'left',
            brightness: 100,
            readingMode: 'paginated',
            enableSkinBackground: true
        })
        setConfirmAction(null)
        showToast(t('appSettings.resetAllSettingsSuccess'))
    }

    const handleSignOut = () => {
        setConfirmAction(null)
        onLogout()
    }

    const handleToggleScreenAwake = async () => {
        await setKeepScreenAwake(!keepScreenAwake)
    }

    const handleToggleSkinBackground = async () => {
        await updateCurrentUserPreferences({
            enableSkinBackground: !(currentUser?.preferences?.enableSkinBackground ?? true)
        })
    }

    const formatSyncTime = (date: Date | null) => {
        if (!date) return ''
        const now = new Date()
        const diff = now.getTime() - new Date(date).getTime()
        const minutes = Math.floor(diff / 60000)
        if (minutes < 1) return t('appSettings.lastSynced', { time: 'just now' })
        if (minutes < 60) return t('appSettings.lastSynced', { time: `${minutes}m ago` })
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return t('appSettings.lastSynced', { time: `${hours}h ago` })
        return t('appSettings.lastSynced', { time: new Date(date).toLocaleDateString() })
    }

    const getSyncStatus = () => {
        if (isSyncing) return { label: t('appSettings.syncStatusSyncing'), dot: 'syncing' }
        if (isOnline) return { label: t('appSettings.syncStatusOn'), dot: 'online' }
        return { label: t('appSettings.syncStatusOff'), dot: 'offline' }
    }

    const syncStatus = getSyncStatus()

    const sortOptions = [
        { value: 'addedAt', label: t('appSettings.sortRecentlyAdded') },
        { value: 'lastReadAt', label: t('appSettings.sortLastRead') },
        { value: 'title', label: t('appSettings.sortTitle') },
        { value: 'author', label: t('appSettings.sortAuthor') }
    ]

    return (
        <div className="settings">
            {/* Header */}
            <header className="settings-header">
                <h1 className="settings-title">{t('appSettings.title')}</h1>
            </header>

            <main className="settings-content">
                {/* ─── Profile ─── */}
                <section className="settings-section">
                    <span className="settings-section-label">{t('appSettings.profile')}</span>
                    <div className="settings-section-card">
                        <div className="settings-profile-card">
                            <div className="settings-avatar">{userInitial}</div>
                            <div className="settings-profile-info">
                                <p className="settings-profile-name">
                                    {userName}
                                    {isPro
                                        ? <span className="settings-pro-badge">{t('appSettings.proBadge')}</span>
                                        : <span className="settings-free-badge">{t('appSettings.freePlan')}</span>
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Subscription */}
                        {isPro && hasStripeCustomer ? (
                            <button
                                className="settings-row"
                                disabled={portalLoading}
                                onClick={async () => {
                                    setPortalLoading(true)
                                    try {
                                        const user = auth.currentUser
                                        if (!user) throw new Error('Not authenticated')
                                        const token = await user.getIdToken()
                                        const res = await fetch('/api/create-portal-session', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${token}`
                                            },
                                            body: JSON.stringify({ userId: user.uid })
                                        })
                                        const data = await res.json()
                                        if (data.url) {
                                            window.location.href = data.url
                                        } else {
                                            showToast(data.error || t('appSettings.portalError'))
                                        }
                                    } catch {
                                        showToast(t('appSettings.portalError'))
                                    } finally {
                                        setPortalLoading(false)
                                    }
                                }}
                            >
                                <div className="settings-row-icon">
                                    <Crown size={18} />
                                </div>
                                <div className="settings-row-text">
                                    <p className="settings-row-title">{t('appSettings.subscription')}</p>
                                    <p className="settings-row-desc">{t('appSettings.manageProDesc')}</p>
                                </div>
                                {portalLoading ? (
                                    <Loader2 size={16} className="settings-row-chevron spinning" />
                                ) : (
                                    <>
                                        <span className="settings-row-value">{t('appSettings.managePro')}</span>
                                        <ExternalLink size={14} className="settings-row-chevron" />
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                className="settings-row"
                                onClick={() => setActiveTab('store')}
                            >
                                <div className="settings-row-icon">
                                    <Crown size={18} />
                                </div>
                                <div className="settings-row-text">
                                    <p className="settings-row-title">{t('appSettings.subscription')}</p>
                                </div>
                                <span className="settings-row-value">
                                    {t('appSettings.upgradeToPro')}
                                </span>
                                <ChevronRight size={16} className="settings-row-chevron" />
                            </button>
                        )}

                        {/* Sign out */}
                        {confirmAction === 'signout' ? (
                            <div className="settings-confirm-bar">
                                <span className="settings-confirm-text">{t('appSettings.signOutConfirm')}</span>
                                <button className="settings-confirm-btn cancel" onClick={() => setConfirmAction(null)}>
                                    {t('appSettings.cancel')}
                                </button>
                                <button className="settings-confirm-btn confirm" onClick={handleSignOut}>
                                    {t('appSettings.signOut')}
                                </button>
                            </div>
                        ) : (
                            <button
                                className="settings-signout-row"
                                onClick={() => setConfirmAction('signout')}
                            >
                                <LogOut size={18} />
                                {t('appSettings.signOut')}
                            </button>
                        )}
                    </div>
                </section>

                {/* ─── General ─── */}
                <section className="settings-section">
                    <span className="settings-section-label">{t('appSettings.general')}</span>
                    <div className="settings-section-card">
                        {/* Language */}
                        <div className="settings-row">
                            <div className="settings-row-icon">
                                <Globe size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.language')}</p>
                            </div>
                            <div className="settings-segmented">
                                <button
                                    className={`settings-segmented-btn ${i18n.language === 'en' ? 'active' : ''}`}
                                    onClick={() => handleLanguageChange('en')}
                                >
                                    {t('appSettings.languageEn')}
                                </button>
                                <button
                                    className={`settings-segmented-btn ${i18n.language === 'pt' ? 'active' : ''}`}
                                    onClick={() => handleLanguageChange('pt')}
                                >
                                    {t('appSettings.languagePt')}
                                </button>
                            </div>
                        </div>

                        {/* Replay onboarding */}
                        <button className="settings-row" onClick={handleReplayOnboarding}>
                            <div className="settings-row-icon">
                                <RotateCcw size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.replayOnboarding')}</p>
                                <p className="settings-row-desc">{t('appSettings.replayOnboardingDesc')}</p>
                            </div>
                            <ChevronRight size={16} className="settings-row-chevron" />
                        </button>

                        {/* App theme skin */}
                        <button className="settings-row" onClick={() => setActiveTab('skins')}>
                            <div className="settings-row-icon">
                                <Palette size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.appThemeSkin')}</p>
                                <p className="settings-row-desc">{t('appSettings.appThemeSkinDesc')}</p>
                            </div>
                            <ChevronRight size={16} className="settings-row-chevron" />
                        </button>

                        {/* App theme skin bg */}
                        <div className="settings-row" onClick={() => void handleToggleSkinBackground()}>
                            <div className="settings-row-icon">
                                <ImageIcon size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.appThemeSkinBg')}</p>
                                <p className="settings-row-desc">{t('appSettings.appThemeSkinBgDesc')}</p>
                            </div>
                            <button
                                className={`settings-toggle ${(currentUser?.preferences?.enableSkinBackground ?? true) ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); void handleToggleSkinBackground() }}
                                aria-label={t('appSettings.appThemeSkinBg')}
                            >
                                <span className="settings-toggle-knob" />
                            </button>
                        </div>

                        {/* Reading statistics (disabled) */}
                        <div className="settings-row disabled">
                            <div className="settings-row-icon">
                                <BarChart3 size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.readingStatistics')}</p>
                                <p className="settings-row-desc">{t('appSettings.readingStatisticsDesc')}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ─── Library ─── */}
                <section className="settings-section">
                    <span className="settings-section-label">{t('appSettings.library')}</span>
                    <div className="settings-section-card">
                        {/* Default view */}
                        <div className="settings-row">
                            <div className="settings-row-icon">
                                <LayoutGrid size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.defaultView')}</p>
                            </div>
                            <div className="settings-segmented">
                                <button
                                    className={`settings-segmented-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                    onClick={() => handleViewModeChange('grid')}
                                >
                                    {t('appSettings.grid')}
                                </button>
                                <button
                                    className={`settings-segmented-btn ${viewMode === 'list' ? 'active' : ''}`}
                                    onClick={() => handleViewModeChange('list')}
                                >
                                    {t('appSettings.list')}
                                </button>
                            </div>
                        </div>

                        {/* Default sort */}
                        <div className="settings-row">
                            <div className="settings-row-icon">
                                <List size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.defaultSort')}</p>
                            </div>
                            <select
                                className="settings-select"
                                value={sortBy}
                                onChange={(e) => handleSortChange(e.target.value)}
                            >
                                {sortOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Collections shortcut */}
                        <button className="settings-row" onClick={() => setActiveTab('library')}>
                            <div className="settings-row-icon">
                                <FolderOpen size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.collections')}</p>
                                <p className="settings-row-desc">{t('appSettings.collectionsDesc')}</p>
                            </div>
                            <ChevronRight size={16} className="settings-row-chevron" />
                        </button>
                    </div>
                </section>

                {/* ─── Sync & Storage ─── */}
                <section className="settings-section">
                    <span className="settings-section-label">{t('appSettings.syncAndStorage')}</span>
                    <div className="settings-section-card">
                        {/* Cloud sync status */}
                        <div className="settings-row">
                            <div className="settings-row-icon">
                                <Cloud size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.cloudSync')}</p>
                                {lastSyncTime && (
                                    <p className="settings-row-desc">{formatSyncTime(lastSyncTime)}</p>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`settings-sync-dot ${syncStatus.dot}`} />
                                <span className="settings-row-value">{syncStatus.label}</span>
                            </div>
                        </div>

                        {/* Downloaded books */}
                        <div className="settings-row">
                            <div className="settings-row-icon">
                                <HardDrive size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.downloadedBooks')}</p>
                            </div>
                            <span className="settings-row-value">
                                {t('appSettings.downloadedBooksCount', { count: downloadedCount })}
                            </span>
                        </div>

                        {/* Clear local downloads */}
                        {confirmAction === 'clear-downloads' ? (
                            <div className="settings-confirm-bar">
                                <span className="settings-confirm-text">{t('appSettings.clearLocalDownloadsConfirm')}</span>
                                <button className="settings-confirm-btn cancel" onClick={() => setConfirmAction(null)}>
                                    {t('appSettings.cancel')}
                                </button>
                                <button className="settings-confirm-btn confirm" onClick={handleClearDownloads}>
                                    {t('appSettings.confirm')}
                                </button>
                            </div>
                        ) : (
                            <button
                                className="settings-row"
                                onClick={() => setConfirmAction('clear-downloads')}
                                disabled={downloadedCount === 0}
                            >
                                <div className="settings-row-icon destructive">
                                    <Trash2 size={18} />
                                </div>
                                <div className="settings-row-text">
                                    <p className="settings-row-title destructive">{t('appSettings.clearLocalDownloads')}</p>
                                    <p className="settings-row-desc">{t('appSettings.clearLocalDownloadsDesc')}</p>
                                </div>
                            </button>
                        )}

                        {/* Keep screen awake */}
                        <div className="settings-row" onClick={wakeLockSupported ? handleToggleScreenAwake : undefined}>
                            <div className="settings-row-icon">
                                <Monitor size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.keepScreenAwake')}</p>
                                <p className="settings-row-desc">
                                    {wakeLockSupported
                                        ? t('appSettings.keepScreenAwakeDesc')
                                        : t('appSettings.keepScreenAwakeUnsupported')
                                    }
                                </p>
                            </div>
                            {wakeLockSupported && (
                                <button
                                    className={`settings-toggle ${keepScreenAwake ? 'active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); handleToggleScreenAwake() }}
                                    aria-label={t('appSettings.keepScreenAwake')}
                                >
                                    <span className="settings-toggle-knob" />
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* ─── About ─── */}
                <section className="settings-section">
                    <span className="settings-section-label">{t('appSettings.about')}</span>
                    <div className="settings-section-card">
                        {/* About Codex */}
                        <div className="settings-row">
                            <div className="settings-row-icon">
                                <Info size={18} />
                            </div>
                            <div className="settings-row-text">
                                <p className="settings-row-title">{t('appSettings.aboutCodex')}</p>
                            </div>
                            <span className="settings-row-value">
                                {t('appSettings.appVersion', { version: APP_VERSION })}
                            </span>
                        </div>

                        {/* Reset all settings */}
                        {confirmAction === 'reset-settings' ? (
                            <div className="settings-confirm-bar">
                                <span className="settings-confirm-text">{t('appSettings.resetAllSettingsConfirm')}</span>
                                <button className="settings-confirm-btn cancel" onClick={() => setConfirmAction(null)}>
                                    {t('appSettings.cancel')}
                                </button>
                                <button className="settings-confirm-btn confirm" onClick={handleResetAllSettings}>
                                    {t('appSettings.confirm')}
                                </button>
                            </div>
                        ) : (
                            <button className="settings-row" onClick={() => setConfirmAction('reset-settings')}>
                                <div className="settings-row-icon destructive">
                                    <RefreshCw size={18} />
                                </div>
                                <div className="settings-row-text">
                                    <p className="settings-row-title destructive">{t('appSettings.resetAllSettings')}</p>
                                    <p className="settings-row-desc">{t('appSettings.resetAllSettingsDesc')}</p>
                                </div>
                            </button>
                        )}
                    </div>
                </section>

                {/* Version footer */}
                <p className="settings-version">Codex v{APP_VERSION}</p>
            </main>

            {/* Toast */}
            {toast && <div className="settings-toast">{toast}</div>}
        </div>
    )
}
