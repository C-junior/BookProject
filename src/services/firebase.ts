/**
 * Firebase Configuration for Codex
 * Authentication (Google) and Firestore Database
 */
import { initializeApp } from 'firebase/app'
import {
    getAuth,
    signInWithPopup,
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

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAUsk52ya-RMnpnsSOJn6sw-3ltBl24bZ4",
    authDomain: "codex-f87f0.firebaseapp.com",
    projectId: "codex-f87f0",
    storageBucket: "codex-f87f0.firebasestorage.app",
    messagingSenderId: "1081794339855",
    appId: "1:1081794339855:web:e5bafebf8532a482ab6f7a",
    measurementId: "G-0VEF32CE4Q"
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
 * Sign in with Google popup
 */
export async function signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(auth, googleProvider)

    // Create/update user profile in Firestore
    await createOrUpdateUserProfile(result.user)

    return result.user
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
    preferences?: {
        theme: 'light' | 'dark' | 'sepia'
        fontSize: number
        fontFamily: string
    }
}

/**
 * Create or update user profile in Firestore
 */
async function createOrUpdateUserProfile(user: User): Promise<void> {
    const userRef = doc(db, 'users', user.uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
        // Create new user profile
        const userData: UserProfileData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
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
    cfiRange?: string
    text: string
    note?: string
    color: string
    label?: string
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

export { auth, app, db }
export type { User, Firestore, UserProfileData, SyncedProgress, SyncedCollection, SyncedAnnotation }

