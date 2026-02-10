import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import './ErrorBoundary.css'

interface ErrorBoundaryProps {
    children: ReactNode
    fallbackTitle?: string
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught:', error, errorInfo)
    }

    private handleReload = () => {
        window.location.reload()
    }

    private handleRecover = () => {
        this.setState({ hasError: false, error: null })
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-boundary__card">
                        <AlertCircle size={48} className="error-boundary__icon" />
                        <h2 className="error-boundary__title">
                            {this.props.fallbackTitle || 'Something went wrong'}
                        </h2>
                        <p className="error-boundary__message">
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </p>
                        <div className="error-boundary__actions">
                            <button className="error-boundary__btn error-boundary__btn--secondary" onClick={this.handleRecover}>
                                Try Again
                            </button>
                            <button className="error-boundary__btn error-boundary__btn--primary" onClick={this.handleReload}>
                                <RefreshCw size={16} />
                                Reload App
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
