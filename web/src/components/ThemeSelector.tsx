import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import './ThemeSelector.css'

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useTheme()

  return (
    <div className="theme-selector">
      <button
        className={`theme-option ${theme === 'light' ? 'active' : ''}`}
        onClick={() => setTheme('light')}
        aria-label="Light theme"
        title="Light theme"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M8 2V1M8 15V14M3.5 3.5L2.5 2.5M13.5 13.5L12.5 12.5M2 8H1M15 8H14M3.5 12.5L2.5 13.5M13.5 3.5L12.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => setTheme('dark')}
        aria-label="Dark theme"
        title="Dark theme"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 2C5.2 2 3 4.2 3 7C3 9.8 5.2 12 8 12C10.8 12 13 9.8 13 7C13 4.2 10.8 2 8 2Z" fill="currentColor" />
          <path d="M8 1V2M8 14V15M3.5 3.5L2.5 2.5M13.5 13.5L12.5 12.5M2 8H1M15 8H14M3.5 12.5L2.5 13.5M13.5 3.5L12.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        className={`theme-option ${theme === 'system' ? 'active' : ''}`}
        onClick={() => setTheme('system')}
        aria-label="System theme"
        title="System theme"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M5 3V1M11 3V1M5 8H11M5 11H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

