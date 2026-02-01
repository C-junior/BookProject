import React from 'react'
import './Card.css'

interface CardProps {
    children: React.ReactNode
    className?: string
    onClick?: () => void
    hoverable?: boolean
    padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({
    children,
    className = '',
    onClick,
    hoverable = false,
    padding = 'md'
}: CardProps) {
    const Component = onClick ? 'button' : 'div'

    return (
        <Component
            className={`
        card 
        card-padding-${padding}
        ${hoverable || onClick ? 'card-hoverable' : ''}
        ${className}
      `.trim()}
            onClick={onClick}
            type={onClick ? 'button' : undefined}
        >
            {children}
        </Component>
    )
}

interface CardHeaderProps {
    children: React.ReactNode
    className?: string
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
    return (
        <div className={`card-header ${className}`}>
            {children}
        </div>
    )
}

interface CardBodyProps {
    children: React.ReactNode
    className?: string
}

export function CardBody({ children, className = '' }: CardBodyProps) {
    return (
        <div className={`card-body ${className}`}>
            {children}
        </div>
    )
}

interface CardFooterProps {
    children: React.ReactNode
    className?: string
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
    return (
        <div className={`card-footer ${className}`}>
            {children}
        </div>
    )
}

export default Card
