import { useState, useEffect } from 'react'
import { useUserStore } from '@/stores/userStore'
import { isFirebaseConfigured, signInWithGoogle, signIn, signUp } from '@/services/firebase'
import { Plus } from 'lucide-react'
import './LoginScreen.css'

interface LoginScreenProps {
    onAuthenticated: () => void
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
    const { users, loadUsers, createNewUser, switchUser, currentUser } = useUserStore()

    const [mode, setMode] = useState<'select' | 'login' | 'register' | 'create-profile'>('select')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [profileName, setProfileName] = useState('')
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const useFirebase = isFirebaseConfigured()

    useEffect(() => {
        loadUsers()
    }, [loadUsers])

    // If using local auth and user is already selected, auto-authenticate
    useEffect(() => {
        if (!useFirebase && currentUser) {
            onAuthenticated()
        }
    }, [currentUser, useFirebase, onAuthenticated])

    const handleGoogleSignIn = async () => {
        setIsLoading(true)
        setError(null)

        try {
            await signInWithGoogle()
            onAuthenticated()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Google sign-in failed')
            setIsLoading(false)
        }
    }

    const handleProfileSelect = async (userId: string) => {
        setSelectedUserId(userId)
        if (!useFirebase) {
            // Local auth: just switch user and continue
            await switchUser(userId)
            onAuthenticated()
        } else {
            // Firebase auth: need to login
            setMode('login')
        }
    }

    const handleFirebaseLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        try {
            await signIn(email, password)
            onAuthenticated()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed')
        } finally {
            setIsLoading(false)
        }
    }

    const handleFirebaseRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        try {
            await signUp(email, password)
            // Also create local profile
            await createNewUser(email.split('@')[0])
            onAuthenticated()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreateProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profileName.trim()) return

        setIsLoading(true)
        setError(null)

        try {
            await createNewUser(profileName.trim())
            onAuthenticated()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create profile')
        } finally {
            setIsLoading(false)
        }
    }

    // Firebase Login/Register forms
    if (useFirebase && (mode === 'login' || mode === 'register')) {
        const isLogin = mode === 'login'
        return (
            <div className="login-screen">
                <div className="login-container">
                    <header className="login-header">
                        <img src="/codex_logo.png" alt="Codex" className="login-logo" />
                        <h1 className="login-title">Codex</h1>
                        <p className="login-subtitle">
                            {isLogin ? 'Welcome back!' : 'Create your account'}
                        </p>
                    </header>

                    {/* Google Sign-In Button */}
                    <button
                        className="google-signin-btn"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                    >
                        <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {isLoading ? 'Signing in...' : 'Continue with Google'}
                    </button>

                    <div className="login-divider">
                        <span>or</span>
                    </div>

                    <form className="login-form" onSubmit={isLogin ? handleFirebaseLogin : handleFirebaseRegister}>
                        {error && <div className="login-error">{error}</div>}

                        <div className="login-field">
                            <label className="login-label">Email</label>
                            <input
                                type="email"
                                className="login-input"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="login-field">
                            <label className="login-label">Password</label>
                            <input
                                type="password"
                                className="login-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            className="login-submit"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                        </button>
                    </form>

                    <div className="login-toggle">
                        <span className="login-toggle-text">
                            {isLogin ? "Don't have an account?" : 'Already have an account?'}
                        </span>
                        <button
                            className="login-toggle-link"
                            onClick={() => setMode(isLogin ? 'register' : 'login')}
                        >
                            {isLogin ? 'Sign Up' : 'Sign In'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Create Profile form (local auth)
    if (mode === 'create-profile') {
        return (
            <div className="login-screen">
                <div className="login-container">
                    <header className="login-header">
                        <img src="/codex_logo.png" alt="Codex" className="login-logo" />
                        <h1 className="login-title">Codex</h1>
                        <p className="login-subtitle">Create a reading profile</p>
                    </header>

                    <form className="login-form" onSubmit={handleCreateProfile}>
                        {error && <div className="login-error">{error}</div>}

                        <div className="login-field">
                            <label className="login-label">Profile Name</label>
                            <input
                                type="text"
                                className="login-input"
                                placeholder="Your name"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            className="login-submit"
                            disabled={isLoading || !profileName.trim()}
                        >
                            {isLoading ? 'Creating...' : 'Create Profile'}
                        </button>
                    </form>

                    {users.length > 0 && (
                        <div className="login-toggle">
                            <button
                                className="login-toggle-link"
                                onClick={() => setMode('select')}
                            >
                                ← Back to profiles
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Profile Selection (default) - Now with Google Sign-In option
    return (
        <div className="login-screen">
            <div className="login-container">
                <header className="login-header">
                    <img src="/codex_logo.png" alt="Codex" className="login-logo" />
                    <h1 className="login-title">Codex</h1>
                    <p className="login-subtitle">Your Personal Library</p>
                </header>

                {/* Firebase: Show Google Sign-In as primary option */}
                {useFirebase && (
                    <>
                        <button
                            className="google-signin-btn"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                        >
                            <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            {isLoading ? 'Signing in...' : 'Continue with Google'}
                        </button>

                        <div className="login-divider">
                            <span>or use email</span>
                        </div>

                        <button
                            className="login-submit login-submit-secondary"
                            onClick={() => setMode('login')}
                        >
                            Sign in with Email
                        </button>
                    </>
                )}

                {/* Local auth: Show profile selection */}
                {!useFirebase && (
                    <>
                        <div className="local-auth-info">
                            📚 Your reading data is stored locally on this device
                        </div>

                        <div className="profile-grid">
                            {users.map((user) => (
                                <button
                                    key={user.id}
                                    className={`profile-card ${selectedUserId === user.id ? 'selected' : ''}`}
                                    onClick={() => handleProfileSelect(user.id)}
                                >
                                    <div className="profile-avatar">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="profile-name">{user.name}</span>
                                </button>
                            ))}

                            <button
                                className="profile-card profile-add"
                                onClick={() => setMode('create-profile')}
                            >
                                <Plus size={24} className="profile-add-icon" />
                                <span className="profile-name">New Profile</span>
                            </button>
                        </div>

                        {users.length === 0 && (
                            <button
                                className="login-submit"
                                onClick={() => setMode('create-profile')}
                            >
                                Get Started
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default LoginScreen

