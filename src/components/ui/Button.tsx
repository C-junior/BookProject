import React from 'react'
import './Button.css'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    fullWidth?: boolean
    loading?: boolean
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
}

export function Button({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    children,
    disabled,
    className = '',
    ...props
}: ButtonProps) {
    return (
        <button
            className={`
        btn 
        btn-${variant} 
        btn-${size}
        ${fullWidth ? 'btn-full' : ''}
        ${loading ? 'btn-loading' : ''}
        ${className}
      `.trim()}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <span className="btn-spinner" aria-hidden="true" />
            )}
            {!loading && leftIcon && (
                <span className="btn-icon btn-icon-left">{leftIcon}</span>
            )}
            <span className="btn-text">{children}</span>
            {!loading && rightIcon && (
                <span className="btn-icon btn-icon-right">{rightIcon}</span>
            )}
        </button>
    )
}

export default Button
