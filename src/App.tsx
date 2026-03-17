import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useUserStore } from '@/stores/userStore'
import { useReaderStore } from '@/stores/readerStore'
import { LibraryView } from '@/components/library/LibraryView'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { UpdateToast } from '@/components/ui/UpdateToast'
import { SyncErrorToast } from '@/components/ui/SyncErrorToast'
import { syncOnLogin, syncOnLogout } from '@/services/sync/syncService'
import { downloadBookFile } from '@/services/storage/storageService'
import { updateBook } from '@/services/storage/db'
import { auth, isFirebaseConfigured, onAuthChange, handleRedirectResult, getUserProfile, isUserPro } from '@/services/firebase'
import { clearAuthSession, getActiveUserId, getCachedAuthUserId, rememberAuthSession } from '@/services/auth/session'
import type { Book } from '@/types'
import { useNavigationStore, type TabId } from '@/stores/navigationStore'
import { BottomNav } from '@/components/layout/BottomNav'
import { StoreView } from '@/components/store/StoreView'
import './App.css'

// Lazy-load heavy components — epub.js & pdfjs only download when needed
const EpubReader = lazy(() => import('@/components/reader/EpubReader'))
const PdfReader = lazy(() => import('@/components/reader/PdfReader'))
const LoginScreen = lazy(() => import('@/components/auth/LoginScreen'))
const ShareTarget = lazy(() => import('@/components/ui/ShareTarget').then(m => ({ default: m.ShareTarget })))

function App() {
    const { loadUsers, currentUser } = useUserStore()
    const { isReading, currentBook, openBook, closeBook, preferences, setPreferences } = useReaderStore()
    const { activeTab, setActiveTab } = useNavigationStore()
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [isAuthResolved, setIsAuthResolved] = useState(false)
    const [showUpdateToast, setShowUpdateToast] = useState(false)
    const [_downloadingBook, setDownloadingBook] = useState<string | null>(null)
    const [isShareTarget, setIsShareTarget] = useState(() => {
        if (window.location.pathname === '/share-target') return true
        const params = new URLSearchParams(window.location.search)
        if (params.has('url')) { sessionStorage.setItem('pendingShareUrl', params.get('url')!); return true; }; return !!sessionStorage.getItem('pendingShareUrl')
    })
    const syncedUserRef = useRef<string | null>(null)
    const useFirebase = isFirebaseConfigured()

    // Initialize app
    useEffect(() => {
        const init = async () => {
            await loadUsers()
            setIsInitialized(true)
        }
        init()
    }, [loadUsers])

    // Bootstrap auth quickly from cached session, then reconcile with Firebase auth state.
    useEffect(() => {
        if (!isInitialized) return

        if (!useFirebase) {
            setIsAuthenticated(true)
            setIsAuthResolved(true)
            return
        }

        const cachedUid = getCachedAuthUserId()
        if (cachedUid) {
            setIsAuthenticated(true)
            setIsAuthResolved(true)
        }

        handleRedirectResult().catch(console.error)

        const unsubscribe = onAuthChange(async (user) => {
            if (user) {
                rememberAuthSession(user.uid)
                setIsAuthenticated(true)

                if (syncedUserRef.current !== user.uid) {
                    syncedUserRef.current = user.uid
                    try {
                        const fbProfile = await getUserProfile(user.uid)
                        if (fbProfile) {
                            useUserStore.setState((state) => ({ currentUser: state.currentUser ? { ...state.currentUser, isPro: isUserPro(fbProfile) } : null }))
                        }
                        await syncOnLogin()
                    } catch (err) {
                        console.error('Sync on login failed:', err)
                    }
                }

                setIsAuthResolved(true)
                return
            }

            const canUseOfflineSession = Boolean(getCachedAuthUserId()) && !navigator.onLine
            if (!canUseOfflineSession) {
                clearAuthSession()
                syncOnLogout()
                syncedUserRef.current = null
                setIsAuthenticated(false)
            } else {
                setIsAuthenticated(true)
            }

            setIsAuthResolved(true)
        })

        return () => unsubscribe()
    }, [isInitialized, useFirebase])

    useEffect(() => {
        if (currentUser?.preferences) {
            setPreferences(currentUser.preferences)
        }
    }, [currentUser?.preferences, setPreferences])

    // Handle tab navigation from URL query params (e.g. ?tab=store)
    // Persist across auth redirects using sessionStorage
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const urlTab = params.get('tab')
        
        if (urlTab) {
            sessionStorage.setItem('pendingTab', urlTab)
        }

        const requestedTab = sessionStorage.getItem('pendingTab') || urlTab

        if (requestedTab === 'library' || requestedTab === 'store' || requestedTab === 'skins' || requestedTab === 'settings') {
            setActiveTab(requestedTab as TabId)
            // Once authenticated and tab is set, we can clear the pending state
            if (isAuthenticated) {
                sessionStorage.removeItem('pendingTab')
            }
        }
    }, [setActiveTab, isAuthenticated])

    // Apply theme and skin from the active user's saved preferences
    useEffect(() => {
        const appliedPreferences = currentUser?.preferences ?? preferences
        const activeSkin = appliedPreferences.skin

        document.documentElement.setAttribute('data-theme', appliedPreferences.theme)
        if (activeSkin && activeSkin !== 'default') {
             document.documentElement.setAttribute('data-skin', activeSkin)
        } else {
             document.documentElement.removeAttribute('data-skin')
        }
    }, [currentUser?.preferences, preferences])

    // Listen for service worker update events
    useEffect(() => {
        const handleSWUpdate = () => setShowUpdateToast(true)
        window.addEventListener('sw-update-available', handleSWUpdate)
        return () => window.removeEventListener('sw-update-available', handleSWUpdate)
    }, [])

    const handleSWUpdate = () => {
        const doUpdate = (window as any).__codex_updateSW
        if (doUpdate) doUpdate()
    }

    const handleOpenBook = async (book: Book) => {
        const userId = getActiveUserId(currentUser?.id)

        // Cloud-only book: download file first
        if (!book.fileBlob && book.storageUrl) {
            try {
                setDownloadingBook(book.id)
                const blob = await downloadBookFile(book.storageUrl)
                const updatedBook = { ...book, fileBlob: blob, isCloudOnly: false }

                // Cache in IndexedDB for offline access
                await updateBook(book.id, { fileBlob: blob, isCloudOnly: false })

                await openBook(updatedBook, userId)
            } catch (err) {
                console.error('Failed to download cloud book:', err)
                alert(`Could not download "${book.title}". Check your connection and try again.`)
            } finally {
                setDownloadingBook(null)
            }
            return
        }

        await openBook(book, userId)
    }

    const handleCloseBook = () => {
        closeBook()
    }

    const handleAuthenticated = async () => {
        setIsAuthenticated(true)
        if (!useFirebase) return

        const uid = auth.currentUser?.uid
        if (uid && syncedUserRef.current !== uid) {
            syncedUserRef.current = uid
            try {
                await syncOnLogin()
            } catch (err) {
                console.error('Sync on login failed:', err)
            }
        }
    }

    const handleLogout = () => {
        syncOnLogout()
        setIsAuthenticated(false)
    }

    const loadingFallback = (
        <div className="app-loading">
            <div className="app-loading-spinner" />
        </div>
    )

    if (!isInitialized || !isAuthResolved) {
        return loadingFallback
    }

    if (!isAuthenticated) {
        return (
            <Suspense fallback={loadingFallback}>
                <LoginScreen onAuthenticated={handleAuthenticated} />
            </Suspense>
        )
    }

    if (isReading && currentBook) {
        if (currentBook.format === 'epub') {
            return (
                <ErrorBoundary fallbackTitle="Reader Error">
                    <Suspense fallback={loadingFallback}>
                        <EpubReader
                            book={currentBook}
                            onClose={handleCloseBook}
                        />
                    </Suspense>
                </ErrorBoundary>
            )
        }

        if (currentBook.format === 'pdf') {
            return (
                <ErrorBoundary fallbackTitle="Reader Error">
                    <Suspense fallback={loadingFallback}>
                        <PdfReader
                            book={currentBook}
                            onClose={handleCloseBook}
                        />
                    </Suspense>
                </ErrorBoundary>
            )
        }

        return (
            <div className="app-reader-placeholder">
                <p>Reader for {currentBook.format.toUpperCase()} format</p>
                <p>Coming soon!</p>
                <p>Book: {currentBook.title}</p>
                <button onClick={handleCloseBook}>
                    Back to Library
                </button>
            </div>
        )
    }

    // Handle share target route
    if (isShareTarget && isAuthenticated) {
        return (
            <Suspense fallback={loadingFallback}>
                <ShareTarget onComplete={() => {
                    setIsShareTarget(false)
                    window.history.replaceState(null, '', '/')
                }} />
            </Suspense>
        )
    }

    return (
        <ErrorBoundary>
            <div className="app">
                {activeTab === 'library' && (
                    <LibraryView onOpenBook={handleOpenBook} onLogout={handleLogout} />
                )}
                {(activeTab === 'store' || activeTab === 'skins') && (
                    <StoreView />
                )}
                {activeTab === 'settings' && (
                    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
                        <h2>Settings</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Coming soon...</p>
                        <button 
                            onClick={handleLogout}
                            style={{ 
                                marginTop: '20px', 
                                padding: '10px 20px', 
                                background: 'var(--surface-light)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                cursor: 'pointer'
                            }}
                        >
                            Log Out
                        </button>
                    </div>
                )}
                <BottomNav />
            </div>
            {showUpdateToast && (
                <UpdateToast onUpdate={handleSWUpdate} />
            )}
            <SyncErrorToast />
        </ErrorBoundary>
    )
}

export default App



