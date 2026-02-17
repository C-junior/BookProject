# Codex E-Book Reader - Feature Comparison Analysis

**Document Created:** February 17, 2026  
**Compared Against:** Kindle App, ReadERA, Koodo Reader, Google Play Books, Moon+ Reader, Librera

---

## Executive Summary

Codex is a modern, web-based e-book reader with solid core functionality including EPUB/PDF support, cloud sync (Firebase/Supabase), annotations, and a clean UI. However, several features found in competing readers could significantly enhance the user experience.

---

## 🔴 MISSING FEATURES (High Priority)

### 1. **Reading Statistics & Analytics** ⭐⭐⭐
**Found in:** Kindle, Kobo, KOReader, Readest

**What they have:**
- Total reading time tracking
- Average minutes per session
- Pages read per minute
- Books completed counter
- Weekly/monthly reading activity charts
- Reading streaks tracking
- Genre distribution statistics
- Time spent per book

**Codex Status:** ❌ Not implemented

**Why it matters:** Users want insights into their reading habits. This creates engagement and helps track reading goals.

**Proposed Solution:**
```typescript
// New store: readingStatsStore.ts
interface ReadingStats {
    totalReadingTime: number        // seconds
    sessionsCount: number
    booksCompleted: number
    averageSessionTime: number      // seconds
    pagesPerDay: number
    weeklyActivity: { day: string, minutes: number }[]
    genreDistribution: { genre: string, count: number }[]
    readingStreak: number           // days
}
```

**Implementation Priority:** HIGH - Adds significant user engagement value

---

### 2. **Text-to-Speech (TTS) / Read Aloud** ⭐⭐⭐
**Found in:** ReadERA, Librera, Moon+ Reader, Koodo Reader, Foxit PDF

**What they have:**
- Full text-to-speech narration
- Adjustable speech rate
- Voice selection
- Screen-off playback (battery efficient)
- Multitasking support
- Works with complex/scientific words

**Codex Status:** ⚠️ Partially implemented (state exists in readerStore but no actual TTS implementation)

**Why it matters:** Accessibility feature, allows reading while doing other tasks, helps with language learning.

**Proposed Solution:**
```typescript
// Use Web Speech API
const synth = window.speechSynthesis;
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = 1.0;  // adjustable
utterance.pitch = 1.0;
utterance.voice = selectedVoice;
synth.speak(utterance);
```

**Implementation Priority:** HIGH - Critical accessibility feature



### 4. **Advanced PDF Features** ⭐⭐
**Found in:** ReadERA, Foxit PDF, Koodo Reader

**What they have:**
- PDF margin cropping (auto-detect and crop white margins)
- Double-page spread view
- PDF zoom presets
- PDF reflow mode
- Comic/manga viewing mode (right-to-left)
- Contrast adjustment for scanned PDFs

**Codex Status:** ❌ Not implemented (basic PDF reader only)

**Why it matters:** PDFs, especially scanned books and academic papers, benefit greatly from these features.

**Proposed Solution:**
```typescript
// PDF cropping service
async function autoCropPdfPage(canvas: HTMLCanvasElement) {
    // Detect content boundaries
    // Return crop coordinates
}

// New PDF settings
interface PdfSettings {
    cropMargins: boolean;
    dualPageView: boolean;
    contrast: number;
    viewingMode: 'single' | 'double' | 'comic';
}
```

**Implementation Priority:** MEDIUM - Important for PDF-heavy users

---


### 9. **Page Color Options** ⭐
**Found in:** Kindle App (exclusive)

**What they have:**
- White (default)
- Yellow (easier on eyes)
- Mint green (reduces eye strain)
- Black (dark mode)
- Custom colors

**Codex Status:** ⚠️ Limited (light, dark, sepia only)

**Why it matters:** Different color temperatures help with eye strain and reading comfort.

**Proposed Solution:**
```typescript
const THEMES = [
    { value: 'light', label: 'Light', color: '#fffef8' },
    { value: 'dark', label: 'Dark', color: '#121212' },
    { value: 'sepia', label: 'Sepia', color: '#f5e6d3' },
    { value: 'mint', label: 'Mint', color: '#e8f5e9' },      // NEW
    { value: 'yellow', label: 'Warm', color: '#fff9c4' },     // NEW
    { value: 'custom', label: 'Custom', color: '#custom' }    // NEW
]
```

**Implementation Priority:** LOW - Easy win for user comfort

---

### 10. **Batch Import & Library Management** ⭐⭐
**Found in:** Koodo Reader, Librera

**What they have:**
- Import entire folders
- Bulk delete books
- Bulk add to collections
- Drag-and-drop multiple files
- Smart collections (auto-categorize)

**Codex Status:** ⚠️ Partial (supports multiple file selection but limited management)

**Proposed Solution:**
- Add folder import dialog
- Add checkbox selection for bulk actions
- Add smart collection rules

**Implementation Priority:** MEDIUM - Improves UX for large libraries

---

## 🟡 PARTIALLY IMPLEMENTED FEATURES

### 1. **Dictionary Lookup** ⚠️
**Status:** ✅ Implemented (Free Dictionary API + Wikipedia)

**What's working:**
- Word definitions
- Wikipedia summaries
- Modal display
- Dictionary in portuguese is the prior

**What could be better:**
- Add synonym/thesaurus support
- Add pronunciation audio
- Add translation support (Google Translate API)
- Cache looked-up words for offline access

---


### 3. **Text-to-Speech State** ⚠️
**Status:** ⚠️ State exists but no implementation

**What exists in code:**
```typescript
// readerStore.ts
isSpeaking: boolean
speechRate: number
speechVoice: string | null
toggleSpeech: () => void
```

**What's missing:**
- Actual Web Speech API integration
- TTS controls in reader UI
- Voice selection UI
- Playback controls (pause, resume, stop)

---

## 🟢 FEATURES CODEX HAS (Working Well)

### Core Features ✅
1. **EPUB & PDF Support** - Working with epubjs and pdfjs
2. **Cloud Storage** - Firebase/Supabase integration
3. **Local Storage** - IndexedDB with Dexie
4. **Annotations** - Highlights, bookmarks, notes
5. **Reading Progress Sync** - Auto-save position
6. **Collections** - Organize books into folders
7. **Search in Book** - Full-text search in EPUB
8. **Table of Contents** - Navigation panel
9. **Customization** - Fonts, sizes, themes, margins
10. **PWA Support** - Offline reading, installable
11. **Web Share Target** - Share files to app
12. **Sync Service** - Background sync for annotations
13. **Onboarding Tour** - First-time user guidance
14. **Continue Reading Hero** - Quick resume
15. **Multiple Themes** - Light, dark, sepia
16. **Vertical Scroll Mode** - Alternative to pagination
17. **Wake Lock** - Prevent screen dimming
18. **Swipe Navigation** - Touch gestures
19. **Brightness Control** - In-app brightness overlay
20. **Update Notifications** - Service worker updates

### Logic Issues / Bugs Found 🔧

#### 1. **Auto-Save Bookmark Race Condition**
**Location:** `src/services/storage/db.ts` - `upsertAutoSaveBookmark()`

**Issue:** Uses `put()` which is correct, but the auto-save hook may create conflicts with manual bookmarks at same location.

**Proposed Fix:**
```typescript
// Add debouncing to auto-save
const debouncedAutoSave = debounce((location, percentage) => {
    // save logic
}, 2000);
```

---

#### 2. **Collection Duplicate Detection**
**Location:** `src/components/library/LibraryView.tsx`

**Issue:** Duplicate cleanup only runs on load, can cause issues with rapid collection creation.

**Current Code:**
```typescript
const duplicateIds: string[] = []
for (const col of cols) {
    const key = col.name.trim().toLowerCase()
    if (!unique.has(key)) {
        unique.set(key, col)
    } else {
        duplicateIds.push(col.id)
    }
}
```

**Proposed Fix:** Add unique constraint at database level or use transaction for atomic operations.

---

#### 3. **Progress Loading Performance**
**Location:** `src/components/library/LibraryView.tsx` - `loadProgressData()`

**Issue:** Sequential loading of progress for each book (N+1 queries).

**Current Code:**
```typescript
for (const book of books) {
    const progress = await getProgress(book.id, activeUserId)
    // ...
}
```

**Proposed Fix:** Batch load all progress in single query:
```typescript
const allProgress = await db.progress
    .where('userId')
    .equals(activeUserId)
    .toArray();
// Then map to books
```

---

#### 4. **Firebase Error Handling**
**Location:** Multiple files

**Issue:** Firebase errors are logged but user feedback is minimal.

**Proposed Fix:** Add toast notifications for sync failures, retry mechanisms with exponential backoff.

---

#### 5. **Book Deletion Doesn't Clean Storage**
**Location:** `src/services/storage/db.ts` - `deleteBook()`

**Issue:** Deletes from IndexedDB but doesn't remove files from Firebase Storage.

**Proposed Fix:**
```typescript
export async function deleteBook(id: string, storageUrl?: string) {
    await db.books.delete(id);
    
    // Also delete from Firebase Storage
    if (storageUrl) {
        await deleteFileFromStorage(storageUrl);
    }
}
```

---

## 📊 FEATURE COMPARISON TABLE

| Feature | Codex | Kindle | ReadERA | Koodo | Moon+ | Priority |
|---------|-------|--------|---------|-------|-------|----------|
| EPUB/PDF Support | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| Cloud Sync (own) | ✅ | ✅ | ❌ | ✅ | ⚠️ | - |
| Multi-cloud Backup | ❌ | ❌ | ⚠️ | ✅ | ✅ | HIGH |
| Reading Statistics | ❌ | ✅ | ❌ | ✅ | ✅ | HIGH |
| Text-to-Speech | ⚠️ | ❌ | ✅ | ✅ | ✅ | HIGH |
| Reading Goals | ❌ | ✅ | ❌ | ❌ | ✅ | MEDIUM |
| Dictionary | ✅ | ✅ | ❌ | ✅ | ✅ | - |
| Highlights/Notes | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| Export Annotations | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | - |
| Split-Screen | ❌ | ❌ | ✅ | ❌ | ⚠️ | LOW |
| OPDS Catalogs | ❌ | ❌ | ❌ | ❌ | ✅ | MEDIUM |
| Reading Ruler | ❌ | ✅ | ❌ | ❌ | ✅ | LOW |
| Page Colors | ⚠️ | ✅ | ✅ | ✅ | ✅ | LOW |
| PDF Margin Crop | ❌ | ❌ | ✅ | ✅ | ✅ | MEDIUM |
| Batch Import | ⚠️ | ❌ | ✅ | ✅ | ✅ | MEDIUM |
| Reading Mode Scroll | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| Offline Reading | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| PWA/App | ✅ | ❌ | ❌ | ❌ | ❌ | - |

---



## 📝 CONCLUSION

Codex has a solid foundation with excellent core features like cloud sync, annotations, and a modern UI. The biggest gaps are:

1. **Reading Statistics** - Users want to track their reading habits
2. **Text-to-Speech** - Critical accessibility feature (state exists, needs implementation)
3. **Multi-Cloud Backup** - Give users control over their data
4. **PDF Enhancements** - Important for academic/professional users

Implementing these features would bring Codex to parity with or exceed competitors like ReadERA and Kindle App, while maintaining its unique advantages as a web-based, cross-platform reader.

---

## 🔗 References

- [Kindle App Secret Features](https://www.pocket-lint.com/kindle-app-secret-features/)
- [ReadERA Review](https://userreview.net/en/content/readera-review-reviews)
- [Best eBook Reader Apps Android](https://www.androidauthority.com/best-ebook-ereader-apps-for-android-170696/)
- [Koodo Reader GitHub](https://github.com/koodo-reader/koodo-reader)
- [Reading Statistics Discussion](https://blog.the-ebook-reader.com/2025/05/19/ebook-readers-lack-useful-reading-history-and-reading-stats/)
