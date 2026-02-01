/// <reference types="vite/client" />

declare module '*.svg' {
    const content: string
    export default content
}

declare module 'epubjs' {
    export default class ePub {
        constructor(bookPath: string | ArrayBuffer, options?: object)
        renderTo(element: Element | string, options?: object): Rendition
        loaded: {
            metadata: Promise<PackageMetadata>
            cover: Promise<string>
            navigation: Promise<Navigation>
            spine: Promise<Spine>
        }
        coverUrl(): Promise<string | null>
        destroy(): void
    }

    export interface Rendition {
        display(target?: string): Promise<void>
        next(): Promise<void>
        prev(): Promise<void>
        themes: Themes
        on(event: string, callback: Function): void
        off(event: string, callback: Function): void
        annotations: Annotations
        currentLocation(): Location
        destroy(): void
    }

    export interface PackageMetadata {
        title: string
        creator: string
        description: string
        pubdate: string
        publisher: string
        identifier: string
        language: string
        rights: string
        modified_date: string
        layout: string
        orientation: string
        flow: string
        viewport: string
        spread: string
    }

    export interface Navigation {
        toc: NavItem[]
    }

    export interface NavItem {
        id: string
        href: string
        label: string
        subitems?: NavItem[]
    }

    export interface Themes {
        register(name: string, styles: object): void
        select(name: string): void
        fontSize(size: string): void
        font(font: string): void
    }

    export interface Annotations {
        highlight(cfiRange: string, data?: object, callback?: Function, className?: string, styles?: object): void
        underline(cfiRange: string, data?: object, callback?: Function, className?: string, styles?: object): void
        remove(cfiRange: string, type: string): void
    }

    export interface Location {
        start: {
            cfi: string
            displayed: {
                page: number
                total: number
            }
            href: string
            index: number
            percentage: number
        }
        end: {
            cfi: string
            displayed: {
                page: number
                total: number
            }
            href: string
            index: number
            percentage: number
        }
        atStart: boolean
        atEnd: boolean
    }

    export interface Spine {
        items: SpineItem[]
    }

    export interface SpineItem {
        href: string
        index: number
    }
}
