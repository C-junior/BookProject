/**
 * Onboarding step configuration
 */
export interface OnboardingStep {
    id: string
    target?: string // CSS selector for spotlight (optional - if not provided, centers on screen)
    title: string
    description: string
    position: 'top' | 'bottom' | 'left' | 'right' | 'center'
    highlight?: boolean // Whether to highlight the target element
}

export const onboardingSteps: OnboardingStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to Codex! 📚',
        description: 'Your personal e-book reader with cloud sync, highlights, and collections. Let\'s take a quick tour!',
        position: 'center'
    },
    {
        id: 'add-book',
        target: '.library-header-actions button[class*="primary"]',
        title: 'Add Your First Book',
        description: 'Click here to import EPUB or PDF files from your device. Drag and drop also works!',
        position: 'bottom',
        highlight: true
    },
    {
        id: 'book-card',
        target: '.library-grid .book-card:first-child, .library-empty',
        title: 'Your Book Library',
        description: 'Your books appear here as cards. Click any book to start reading.',
        position: 'top',
        highlight: true
    },
    {
        id: 'collections',
        target: '.library-header-actions button:has(.lucide-folder-open)',
        title: 'Organize with Collections',
        description: 'Create collections to organize your books - like Favorites, Reading Now, or by genre.',
        position: 'bottom',
        highlight: true
    },
    {
        id: 'highlights',
        title: 'Highlights & Notes ✨',
        description: 'While reading, select any text to highlight it, add notes, or look up definitions.',
        position: 'center'
    },
    {
        id: 'sync',
        target: '.sync-indicator',
        title: 'Cloud Sync',
        description: 'Your progress and highlights sync automatically across all your devices.',
        position: 'bottom',
        highlight: true
    },
    {
        id: 'finish',
        title: 'You\'re All Set! 🎉',
        description: 'Enjoy your reading! The tour won\'t show again, but you can always explore the app.',
        position: 'center'
    }
]
