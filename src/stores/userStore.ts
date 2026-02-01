import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, ReaderPreferences } from '@/types'
import { createUser, getUser, getAllUsers, updateUserPreferences, deleteUser } from '@/services/storage/db'

interface UserState {
    currentUser: UserProfile | null
    users: UserProfile[]
    isLoading: boolean

    // Actions
    loadUsers: () => Promise<void>
    createNewUser: (name: string) => Promise<UserProfile>
    switchUser: (userId: string) => Promise<void>
    updateCurrentUserPreferences: (prefs: Partial<ReaderPreferences>) => Promise<void>
    removeUser: (userId: string) => Promise<void>
    getCurrentUserId: () => string
}

const DEFAULT_USER_ID = 'default-user'

const defaultPreferences: ReaderPreferences = {
    theme: 'light',
    fontFamily: 'Literata',
    fontSize: 18,
    lineHeight: 1.6,
    margins: 40,
    textAlign: 'left',
    brightness: 100
}

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            currentUser: null,
            users: [],
            isLoading: false,

            // Load all users from database
            loadUsers: async () => {
                set({ isLoading: true })
                try {
                    let users = await getAllUsers()

                    // Create default user if none exist
                    if (users.length === 0) {
                        const defaultUser: UserProfile = {
                            id: DEFAULT_USER_ID,
                            name: 'Reader',
                            createdAt: new Date(),
                            preferences: defaultPreferences
                        }
                        await createUser(defaultUser)
                        users = [defaultUser]
                    }

                    // Set current user from persisted ID or default
                    const { currentUser } = get()
                    const currentUserId = currentUser?.id || DEFAULT_USER_ID
                    const user = users.find(u => u.id === currentUserId) || users[0]

                    set({
                        users,
                        currentUser: user,
                        isLoading: false
                    })
                } catch (error) {
                    console.error('Failed to load users:', error)
                    set({ isLoading: false })
                }
            },

            // Create a new user profile
            createNewUser: async (name: string) => {
                const newUser: UserProfile = {
                    id: `user-${Date.now()}`,
                    name,
                    createdAt: new Date(),
                    preferences: defaultPreferences
                }

                await createUser(newUser)
                set(state => ({
                    users: [...state.users, newUser],
                    currentUser: newUser
                }))

                return newUser
            },

            // Switch to a different user
            switchUser: async (userId: string) => {
                const user = await getUser(userId)
                if (user) {
                    set({ currentUser: user })
                }
            },

            // Update preferences for current user
            updateCurrentUserPreferences: async (prefs: Partial<ReaderPreferences>) => {
                const { currentUser } = get()
                if (!currentUser) return

                await updateUserPreferences(currentUser.id, prefs)

                set(state => ({
                    currentUser: state.currentUser ? {
                        ...state.currentUser,
                        preferences: { ...state.currentUser.preferences, ...prefs }
                    } : null,
                    users: state.users.map(u =>
                        u.id === currentUser.id
                            ? { ...u, preferences: { ...u.preferences, ...prefs } }
                            : u
                    )
                }))
            },

            // Remove a user
            removeUser: async (userId: string) => {
                const { users, currentUser } = get()

                // Prevent deleting the last user
                if (users.length <= 1) {
                    throw new Error('Cannot delete the last user')
                }

                await deleteUser(userId)

                const remainingUsers = users.filter(u => u.id !== userId)
                const newCurrentUser = currentUser?.id === userId
                    ? remainingUsers[0]
                    : currentUser

                set({
                    users: remainingUsers,
                    currentUser: newCurrentUser
                })
            },

            // Get current user ID (with fallback)
            getCurrentUserId: () => {
                return get().currentUser?.id || DEFAULT_USER_ID
            }
        }),
        {
            name: 'pageturner-user',
            partialize: (state) => ({
                currentUser: state.currentUser ? { id: state.currentUser.id } : null
            })
        }
    )
)
