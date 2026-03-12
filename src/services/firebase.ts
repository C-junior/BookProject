/**
 * Firebase Configuration for Codex
 * Authentication (Google) and Firestore Database
 */
import { initializeApp } from 'firebase/app'
import {
    getAuth,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User
} from 'firebase/auth'
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
    type Firestore
} from 'firebase/firestore'

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
    return !!(firebaseConfig.apiKey && firebaseConfig.projectId)
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

// Google Auth Provider
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({
    prompt: 'select_account'
})

// ============================================
// Authentication Methods
// ============================================

/**
 * Sign in with Google — tries popup first, falls back to redirect
 * if popup is blocked by Cross-Origin-Opener-Policy (COOP).
 */
export async function signInWithGoogle(): Promise<User> {
    try {
        const result = await signInWithPopup(auth, googleProvider)
        await createOrUpdateUserProfile(result.user)
        return result.user
    } catch (error: unknown) {
        const fbError = error as { code?: string; message?: string }
        // Popup blocked by COOP, browser policy, or popup blocker → use redirect
        if (
            fbError.code === 'auth/popup-blocked' ||
            fbError.code === 'auth/popup-closed-by-user' ||
            fbError.code === 'auth/cancelled-popup-request' ||
            fbError.message?.includes('Cross-Origin-Opener-Policy')
        ) {
            console.warn('Popup auth blocked, falling back to redirect flow')
            await signInWithRedirect(auth, googleProvider)
            // After redirect, the page reloads and handleRedirectResult() picks it up
            // Return a never-resolving promise since the page is about to reload
            return new Promise(() => { })
        }
        throw error
    }
}

/**
 * Handle the result from a redirect-based sign-in.
 * Call this once on app startup to capture redirect results.
 */
export async function handleRedirectResult(): Promise<User | null> {
    try {
        const result = await getRedirectResult(auth)
        if (result?.user) {
            await createOrUpdateUserProfile(result.user)
            return result.user
        }
        return null
    } catch (error) {
        console.error('Redirect sign-in error:', error)
        return null
    }
}

/**
 * Sign in with email/password
 */
export async function signIn(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(auth, email, password)
    return result.user
}

/**
 * Sign up with email/password
 */
export async function signUp(email: string, password: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await createOrUpdateUserProfile(result.user)
    return result.user
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
    await firebaseSignOut(auth)
}

/**
 * Listen to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback)
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
    return auth.currentUser
}

// ============================================
// Firestore - User Profile
// ============================================

interface UserProfileData {
    uid: string
    email: string | null
    displayName: string | null
    photoURL: string | null
    createdAt: unknown
    lastLoginAt: unknown
    trialStartDate?: unknown
    preferences?: {
        theme: 'light' | 'dark' | 'sepia' | 'mint' | 'warm'
        fontSize: number
        fontFamily: string
    }
    isPro?: boolean
}

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Admin emails that always have Pro access (for testing)
const PRO_ADMIN_EMAILS: string[] = [
    // Add test account emails here, e.g.:
    // 'your-email@gmail.com',
    'paulamartinsz1996@gmail.com',
    'aicristovao88@gmail.com'
]

/**
 * Determine if a user has Pro access:
 * - Admin whitelist email
 * - Paid subscriber (isPro === true via Stripe webhook), OR
 * - Active 7-day trial (trialStartDate within last 7 days)
 */
export function isUserPro(profile: UserProfileData | null): boolean {
    if (!profile) return false
    // Admin whitelist — always Pro
    if (profile.email && PRO_ADMIN_EMAILS.includes(profile.email)) return true
    if (profile.isPro) return true

    // Check if trial is still active
    if (profile.trialStartDate) {
        let trialStart: Date
        if (profile.trialStartDate instanceof Date) {
            trialStart = profile.trialStartDate
        } else if (typeof profile.trialStartDate === 'object' && profile.trialStartDate !== null && typeof (profile.trialStartDate as any).toDate === 'function') {
            trialStart = (profile.trialStartDate as any).toDate()
        } else if (typeof profile.trialStartDate === 'string' || typeof profile.trialStartDate === 'number') {
            trialStart = new Date(profile.trialStartDate)
        } else {
            return false
        }
        return (Date.now() - trialStart.getTime()) < TRIAL_DURATION_MS
    }

    return false
}

/**
 * Check if the user is a permanent Pro (either paid or admin whitelist)
 */
export function isUserPermanentlyPro(profile: UserProfileData | null): boolean {
    if (!profile) return false
    if (profile.email && PRO_ADMIN_EMAILS.includes(profile.email)) return true
    if (profile.isPro) return true
    return false
}

/**
 * Get the number of trial days remaining (0 if expired or no trial)
 */
export function getTrialDaysRemaining(profile: UserProfileData | null): number {
    if (!profile || profile.isPro || !profile.trialStartDate) return 0

    let trialStart: Date
    if (profile.trialStartDate instanceof Date) {
        trialStart = profile.trialStartDate
    } else if (typeof profile.trialStartDate === 'object' && profile.trialStartDate !== null && typeof (profile.trialStartDate as any).toDate === 'function') {
        trialStart = (profile.trialStartDate as any).toDate()
    } else if (typeof profile.trialStartDate === 'string' || typeof profile.trialStartDate === 'number') {
        trialStart = new Date(profile.trialStartDate)
    } else {
        return 0
    }

    const elapsed = Date.now() - trialStart.getTime()
    const remaining = TRIAL_DURATION_MS - elapsed
    return remaining > 0 ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0
}

/**
 * Create or update user profile in Firestore
 */
async function createOrUpdateUserProfile(user: User): Promise<void> {
    const userRef = doc(db, 'users', user.uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
        // Create new user profile with 7-day trial
        const userData: UserProfileData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            trialStartDate: serverTimestamp(),
            preferences: {
                theme: 'dark',
                fontSize: 16,
                fontFamily: 'Georgia'
            }
        }
        await setDoc(userRef, userData)
    } else {
        // Update last login
        await updateDoc(userRef, {
            lastLoginAt: serverTimestamp(),
            displayName: user.displayName,
            photoURL: user.photoURL
        })
    }
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfileData | null> {
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    return userSnap.exists() ? userSnap.data() as UserProfileData : null
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
    uid: string,
    preferences: Partial<UserProfileData['preferences']>
): Promise<void> {
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, { preferences })
}

// ============================================
// Firestore - Reading Progress Sync
// ============================================

interface SyncedProgress {
    bookId: string
    userId: string
    location: string
    percentage: number
    chapterTitle?: string
    lastUpdated: unknown
}

/**
 * Sync reading progress to Firestore
 */
export async function syncProgress(
    userId: string,
    bookId: string,
    location: string,
    percentage: number,
    chapterTitle?: string
): Promise<void> {
    const progressRef = doc(db, 'users', userId, 'progress', bookId)
    await setDoc(progressRef, {
        bookId,
        userId,
        location,
        percentage,
        chapterTitle: chapterTitle || null,
        lastUpdated: serverTimestamp()
    })
}

/**
 * Get reading progress from Firestore
 */
export async function getProgress(userId: string, bookId: string): Promise<SyncedProgress | null> {
    const progressRef = doc(db, 'users', userId, 'progress', bookId)
    const progressSnap = await getDoc(progressRef)
    return progressSnap.exists() ? progressSnap.data() as SyncedProgress : null
}

/**
 * Get all reading progress for a user
 */
export async function getAllProgress(userId: string): Promise<SyncedProgress[]> {
    const progressCol = collection(db, 'users', userId, 'progress')
    const progressSnap = await getDocs(progressCol)
    return progressSnap.docs.map(doc => doc.data() as SyncedProgress)
}

// ============================================
// Firestore - Collections Sync
// ============================================

interface SyncedCollection {
    id: string
    name: string
    color: string
    createdAt: unknown
}

/**
 * Sync collection to Firestore
 */
export async function syncCollection(
    userId: string,
    collectionData: { id: string; name: string; color: string }
): Promise<void> {
    const colRef = doc(db, 'users', userId, 'collections', collectionData.id)
    await setDoc(colRef, {
        ...collectionData,
        createdAt: serverTimestamp()
    })
}

/**
 * Delete collection from Firestore
 */
export async function deleteCollection(userId: string, collectionId: string): Promise<void> {
    const colRef = doc(db, 'users', userId, 'collections', collectionId)
    await deleteDoc(colRef)
}

/**
 * Get all collections for a user
 */
export async function getCollections(userId: string): Promise<SyncedCollection[]> {
    const colCol = collection(db, 'users', userId, 'collections')
    const colSnap = await getDocs(colCol)
    return colSnap.docs.map(doc => doc.data() as SyncedCollection)
}

// ============================================
// Firestore - Annotations Sync
// ============================================

interface SyncedAnnotation {
    id: string
    bookId: string
    type: 'highlight' | 'bookmark' | 'note'
    cfiRange?: string | null
    text: string
    note?: string | null
    color: string
    label?: string | null
    createdAt: unknown
}

/**
 * Sync annotation to Firestore
 */
export async function syncAnnotation(
    userId: string,
    annotation: Omit<SyncedAnnotation, 'createdAt'>
): Promise<void> {
    const annoRef = doc(db, 'users', userId, 'annotations', annotation.id)
    await setDoc(annoRef, {
        ...annotation,
        createdAt: serverTimestamp()
    })
}

/**
 * Delete annotation from Firestore
 */
export async function deleteAnnotation(userId: string, annotationId: string): Promise<void> {
    const annoRef = doc(db, 'users', userId, 'annotations', annotationId)
    await deleteDoc(annoRef)
}

/**
 * Get annotations for a book
 */
export async function getBookAnnotations(userId: string, bookId: string): Promise<SyncedAnnotation[]> {
    const annoCol = collection(db, 'users', userId, 'annotations')
    const q = query(annoCol, where('bookId', '==', bookId))
    const annoSnap = await getDocs(q)
    return annoSnap.docs.map(doc => doc.data() as SyncedAnnotation)
}

/**
 * Delete a book metadata document from Firestore
 */
export async function deleteBookMetadata(userId: string, bookId: string): Promise<void> {
    const bookRef = doc(db, 'users', userId, 'books', bookId)
    await deleteDoc(bookRef)
}

export { auth, app, db }
export type { User, Firestore, UserProfileData, SyncedProgress, SyncedCollection, SyncedAnnotation }

