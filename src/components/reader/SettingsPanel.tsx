import type { CSSProperties } from 'react'
import { useReaderStore } from '@/stores/readerStore'
import { X, Sun, Moon, BookOpen, Type, AlignLeft, AlignJustify } from 'lucide-react'
import './SettingsPanel.css'

const FONT_FAMILIES = [
    { value: 'Literata', label: 'Literata', style: 'serif' },
    { value: 'Merriweather', label: 'Merriweather', style: 'serif' },
    { value: 'Georgia', label: 'Georgia', style: 'serif' },
    { value: 'Inter', label: 'Inter', style: 'sans-serif' },
    { value: 'Open Sans', label: 'Open Sans', style: 'sans-serif' },
    { value: 'system-ui', label: 'System Default', style: 'system' }
]

const THEMES = [
    { value: 'light', label: 'Light', icon: Sun, color: '#fffef8' },
    { value: 'dark', label: 'Dark', icon: Moon, color: '#121212' },
    { value: 'sepia', label: 'Sepia', icon: BookOpen, color: '#f5e6d3' }
] as const

export function SettingsPanel() {
    const { preferences, updatePreference, toggleSettings } = useReaderStore()

    return (
        <div className="settings-panel">
            <div className="settings-panel-content">
                {/* Header */}
                <div className="settings-header">
                    <h2 className="settings-title">Reading Settings</h2>
                    <button
                        className="settings-close"
                        onClick={toggleSettings}
                        aria-label="Close settings"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Theme */}
                <div className="settings-section">
                    <label className="settings-label">Theme</label>
                    <div className="settings-theme-grid">
                        {THEMES.map(theme => (
                            <button
                                key={theme.value}
                                className={`settings-theme-button ${preferences.theme === theme.value ? 'active' : ''}`}
                                onClick={() => updatePreference('theme', theme.value)}
                                style={{ '--theme-color': theme.color } as CSSProperties}
                            >
                                <span className="settings-theme-preview" />
                                <span className="settings-theme-label">{theme.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Font Size */}
                <div className="settings-section">
                    <div className="settings-label-row">
                        <label className="settings-label">Font Size</label>
                        <span className="settings-value">{preferences.fontSize}px</span>
                    </div>
                    <div className="settings-slider-row">
                        <span className="settings-slider-label" style={{ fontSize: '12px' }}>A</span>
                        <input
                            type="range"
                            min="12"
                            max="32"
                            step="1"
                            value={preferences.fontSize}
                            onChange={(e) => updatePreference('fontSize', parseInt(e.target.value))}
                            className="settings-slider"
                        />
                        <span className="settings-slider-label" style={{ fontSize: '24px' }}>A</span>
                    </div>
                </div>

                {/* Font Family */}
                <div className="settings-section">
                    <label className="settings-label">
                        <Type size={16} />
                        Font Family
                    </label>
                    <div className="settings-font-grid">
                        {FONT_FAMILIES.map(font => (
                            <button
                                key={font.value}
                                className={`settings-font-button ${preferences.fontFamily === font.value ? 'active' : ''}`}
                                onClick={() => updatePreference('fontFamily', font.value)}
                                style={{ fontFamily: font.value }}
                            >
                                {font.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Line Height */}
                <div className="settings-section">
                    <div className="settings-label-row">
                        <label className="settings-label">Line Spacing</label>
                        <span className="settings-value">{preferences.lineHeight.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min="1.2"
                        max="2.0"
                        step="0.1"
                        value={preferences.lineHeight}
                        onChange={(e) => updatePreference('lineHeight', parseFloat(e.target.value))}
                        className="settings-slider"
                    />
                </div>

                {/* Margins */}
                <div className="settings-section">
                    <div className="settings-label-row">
                        <label className="settings-label">Margins</label>
                        <span className="settings-value">{preferences.margins}px</span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="80"
                        step="5"
                        value={preferences.margins}
                        onChange={(e) => updatePreference('margins', parseInt(e.target.value))}
                        className="settings-slider"
                    />
                </div>

                {/* Text Align */}
                <div className="settings-section">
                    <label className="settings-label">Text Alignment</label>
                    <div className="settings-align-buttons">
                        <button
                            className={`settings-align-button ${preferences.textAlign === 'left' ? 'active' : ''}`}
                            onClick={() => updatePreference('textAlign', 'left')}
                            aria-label="Align left"
                        >
                            <AlignLeft size={20} />
                        </button>
                        <button
                            className={`settings-align-button ${preferences.textAlign === 'justify' ? 'active' : ''}`}
                            onClick={() => updatePreference('textAlign', 'justify')}
                            aria-label="Justify"
                        >
                            <AlignJustify size={20} />
                        </button>
                    </div>
                </div>

                {/* Brightness */}
                <div className="settings-section">
                    <div className="settings-label-row">
                        <label className="settings-label">Brightness</label>
                        <span className="settings-value">{preferences.brightness}%</span>
                    </div>
                    <input
                        type="range"
                        min="20"
                        max="100"
                        step="5"
                        value={preferences.brightness}
                        onChange={(e) => updatePreference('brightness', parseInt(e.target.value))}
                        className="settings-slider"
                    />
                </div>

                {/* Auto-save Position */}
                <div className="settings-section">
                    <div className="settings-toggle-row">
                        <div className="settings-toggle-info">
                            <label className="settings-label">Auto-save Position</label>
                            <span className="settings-hint">Resume where you left off</span>
                        </div>
                        <button
                            className={`settings-toggle ${preferences.autoSavePosition ? 'active' : ''}`}
                            onClick={() => updatePreference('autoSavePosition', !preferences.autoSavePosition)}
                            role="switch"
                            aria-checked={preferences.autoSavePosition}
                        >
                            <span className="settings-toggle-thumb" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SettingsPanel
