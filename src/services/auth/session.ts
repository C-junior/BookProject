import { auth } from '@/services/firebase'

const AUTH_SESSION_KEY = 'codex-auth-session-v1'
const DEFAULT_USER_ID = 'default-user'

interface CachedAuthSession {
    uid: string
    updatedAt: number
}

function readCachedSession(): CachedAuthSession | null {
    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(AUTH_SESSION_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<CachedAuthSession>
        if (!parsed.uid || typeof parsed.uid !== 'string') return null
        return {
            uid: parsed.uid,
            updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now()
        }
    } catch {
        return null
    }
}

export function getCachedAuthUserId(): string | null {
    return readCachedSession()?.uid ?? null
}

export function rememberAuthSession(uid: string): void {
    if (typeof window === 'undefined') return
    const payload: CachedAuthSession = { uid, updatedAt: Date.now() }
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(payload))
}

export function clearAuthSession(): void {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(AUTH_SESSION_KEY)
}

export function getActiveUserId(localFallback?: string | null): string {
    return auth.currentUser?.uid || getCachedAuthUserId() || localFallback || DEFAULT_USER_ID
}

