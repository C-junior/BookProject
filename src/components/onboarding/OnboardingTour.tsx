import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react'
import { onboardingSteps } from './onboardingSteps'
import './OnboardingTour.css'

interface OnboardingTourProps {
    onComplete: () => void
    onSkip: () => void
}

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

    const currentStep = onboardingSteps[currentStepIndex]
    const isFirstStep = currentStepIndex === 0
    const isLastStep = currentStepIndex === onboardingSteps.length - 1

    // Find and measure target element
    useEffect(() => {
        if (currentStep.target) {
            const element = document.querySelector(currentStep.target)
            if (element) {
                const rect = element.getBoundingClientRect()
                setTargetRect(rect)
            } else {
                setTargetRect(null)
            }
        } else {
            setTargetRect(null)
        }
    }, [currentStep])

    const handleNext = useCallback(() => {
        if (isLastStep) {
            onComplete()
        } else {
            setCurrentStepIndex(prev => prev + 1)
        }
    }, [isLastStep, onComplete])

    const handlePrevious = useCallback(() => {
        if (!isFirstStep) {
            setCurrentStepIndex(prev => prev - 1)
        }
    }, [isFirstStep])

    const handleSkip = useCallback(() => {
        onSkip()
    }, [onSkip])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleSkip()
            } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                handleNext()
            } else if (e.key === 'ArrowLeft') {
                handlePrevious()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleNext, handlePrevious, handleSkip])

    // Calculate tooltip position
    const getTooltipStyle = (): React.CSSProperties => {
        if (!targetRect || currentStep.position === 'center') {
            return {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
            }
        }

        const padding = 16
        const tooltipWidth = 320
        const tooltipHeight = 200 // Approximate

        switch (currentStep.position) {
            case 'bottom':
                return {
                    top: targetRect.bottom + padding,
                    left: Math.max(padding, Math.min(
                        targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
                        window.innerWidth - tooltipWidth - padding
                    ))
                }
            case 'top':
                return {
                    bottom: window.innerHeight - targetRect.top + padding,
                    left: Math.max(padding, Math.min(
                        targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
                        window.innerWidth - tooltipWidth - padding
                    ))
                }
            case 'left':
                return {
                    top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
                    right: window.innerWidth - targetRect.left + padding
                }
            case 'right':
                return {
                    top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
                    left: targetRect.right + padding
                }
            default:
                return {
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                }
        }
    }

    return (
        <div className="onboarding-overlay">
            {/* Spotlight cutout */}
            {targetRect && currentStep.highlight && (
                <div
                    className="onboarding-spotlight"
                    style={{
                        top: targetRect.top - 8,
                        left: targetRect.left - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16
                    }}
                />
            )}

            {/* Tooltip */}
            <div className="onboarding-tooltip" style={getTooltipStyle()}>
                {/* Header */}
                <div className="onboarding-tooltip-header">
                    <h3 className="onboarding-tooltip-title">{currentStep.title}</h3>
                    <button
                        className="onboarding-close-btn"
                        onClick={handleSkip}
                        title="Skip tour"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <p className="onboarding-tooltip-content">
                    {currentStep.description}
                </p>

                {/* Footer */}
                <div className="onboarding-tooltip-footer">
                    {/* Progress dots */}
                    <div className="onboarding-progress">
                        {onboardingSteps.map((_, index) => (
                            <div
                                key={index}
                                className={`onboarding-dot ${index === currentStepIndex ? 'active' : ''} ${index < currentStepIndex ? 'completed' : ''}`}
                            />
                        ))}
                    </div>

                    {/* Navigation buttons */}
                    <div className="onboarding-nav">
                        {!isFirstStep && (
                            <button
                                className="onboarding-btn secondary"
                                onClick={handlePrevious}
                            >
                                <ChevronLeft size={16} />
                                Back
                            </button>
                        )}

                        {!isLastStep && (
                            <button
                                className="onboarding-btn skip"
                                onClick={handleSkip}
                            >
                                <SkipForward size={16} />
                                Skip
                            </button>
                        )}

                        <button
                            className="onboarding-btn primary"
                            onClick={handleNext}
                        >
                            {isLastStep ? 'Get Started' : 'Next'}
                            {!isLastStep && <ChevronRight size={16} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
