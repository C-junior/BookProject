import type { CSSProperties } from 'react'
import { useReaderStore } from '@/stores/readerStore'
import { X, Sun, Moon, BookOpen, ScrollText, Type, AlignLeft, AlignJustify, Leaf } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
    { value: 'sepia', label: 'Sepia', icon: BookOpen, color: '#f5e6d3' },
    { value: 'mint', label: 'Mint', icon: Leaf, color: '#e8f5e9' },
    { value: 'warm', label: 'Warm', icon: Sun, color: '#fff9c4' }
] as const

export function SettingsPanel() {
    const { preferences, updatePreference, toggleSettings } = useReaderStore()
    const { t } = useTranslation()

    return (
        <div className="settings-panel">
            <div className="settings-panel-content">
                {/* Header */}
                <div className="settings-header">
                    <h2 className="settings-title">{t('settings.readingSettings')}</h2>
                    <button
                        className="settings-close"
                        onClick={toggleSettings}
                        aria-label={t('settings.closeSettings')}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Theme */}
                <div className="settings-section">
                    <label className="settings-label">{t('settings.theme')}</label>
                    <div className="settings-theme-grid">
                        {THEMES.map(theme => (
                            <button
                                key={theme.value}
                                className={`settings-theme-button ${preferences.theme === theme.value ? 'active' : ''}`}
                                onClick={() => updatePreference('theme', theme.value)}
                                style={{ '--theme-color': theme.color } as CSSProperties}
                            >
                                <span className="settings-theme-preview" />
                                <span className="settings-theme-label">{t(`settings.theme_${theme.value}`)}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Reading Mode (EPUB) */}
                <div className="settings-section">
                    <label className="settings-label">{t('settings.readingMode')}</label>
                    <div className="settings-align-buttons">
                        <button
                            className={`settings-align-button ${preferences.readingMode !== 'vertical-scroll' ? 'active' : ''}`}
                            onClick={() => updatePreference('readingMode', 'paginated')}
                            aria-label={t('settings.readingMode_paginated')}
                            title={t('settings.readingMode_paginated')}
                        >
                            <BookOpen size={20} />
                        </button>
                        <button
                            className={`settings-align-button ${preferences.readingMode === 'vertical-scroll' ? 'active' : ''}`}
                            onClick={() => updatePreference('readingMode', 'vertical-scroll')}
                            aria-label={t('settings.readingMode_verticalScroll')}
                            title={t('settings.readingMode_verticalScroll')}
                        >
                            <ScrollText size={20} />
                        </button>
                    </div>
                </div>

                {/* Font Size */}
                <div className="settings-section">
                    <div className="settings-label-row">
                        <label className="settings-label">{t('settings.fontSize')}</label>
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
                        {t('settings.fontFamily')}
                    </label>
                    <div className="settings-font-grid">
                        {FONT_FAMILIES.map(font => (
                            <button
                                key={font.value}
                                className={`settings-font-button ${preferences.fontFamily === font.value ? 'active' : ''}`}
                                onClick={() => updatePreference('fontFamily', font.value)}
                                style={{ fontFamily: font.value }}
                            >
                                {font.value === 'system-ui' ? t('settings.fontFamily_system') : font.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Line Height */}
                <div className="settings-section">
                    <div className="settings-label-row">
                        <label className="settings-label">{t('settings.lineSpacing')}</label>
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
                        <label className="settings-label">{t('settings.margins')}</label>
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
                    <label className="settings-label">{t('settings.textAlignment')}</label>
                    <div className="settings-align-buttons">
                        <button
                            className={`settings-align-button ${preferences.textAlign === 'left' ? 'active' : ''}`}
                            onClick={() => updatePreference('textAlign', 'left')}
                            aria-label={t('settings.textAlignment_left')}
                        >
                            <AlignLeft size={20} />
                        </button>
                        <button
                            className={`settings-align-button ${preferences.textAlign === 'justify' ? 'active' : ''}`}
                            onClick={() => updatePreference('textAlign', 'justify')}
                            aria-label={t('settings.textAlignment_justify')}
                        >
                            <AlignJustify size={20} />
                        </button>
                    </div>
                </div>

                {/* Brightness */}
                <div className="settings-section">
                    <div className="settings-label-row">
                        <label className="settings-label">{t('settings.brightness')}</label>
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
                            <label className="settings-label">{t('settings.autoSave')}</label>
                            <span className="settings-hint">{t('settings.autoSave_hint')}</span>
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
