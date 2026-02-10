import './LibrarySkeleton.css'

export function LibrarySkeleton() {
    return (
        <div className="library-skeleton">
            {/* Header skeleton */}
            <div className="library-skeleton__header">
                <div className="skeleton library-skeleton__logo" />
                <div className="skeleton library-skeleton__search" />
            </div>

            {/* Grid skeleton */}
            <div className="library-skeleton__grid">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="library-skeleton__card">
                        <div className="skeleton library-skeleton__cover" />
                        <div className="library-skeleton__info">
                            <div className="skeleton library-skeleton__title" />
                            <div className="skeleton library-skeleton__author" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
