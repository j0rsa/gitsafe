import React, { useState, useEffect, useRef } from 'react'
import type { Repository, TileLayout } from '../types'
import './RepositoryTile.css'

export interface RepositoryTileProps {
  repository: Repository
  layout?: TileLayout
  inProgress?: boolean
  onSync?: (id: string) => void
  onDelete?: (id: string) => void
  onEdit?: (id: string) => void
}

export const RepositoryTile: React.FC<RepositoryTileProps> = ({
  repository,
  layout = 'wide',
  inProgress = false,
  onSync,
  onDelete,
  onEdit,
}) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const badgeRef = useRef<HTMLSpanElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    try {
      const date = new Date(dateString)
      return date.toLocaleString()
    } catch {
      return 'Invalid date'
    }
  }

  // Handle touch start on badge (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (repository.error) {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
      // Show tooltip on tap
      setShowTooltip(true)
    }
  }

  // Handle touch move (swipe) - hide tooltip
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current && showTooltip) {
      const touch = e.touches[0]
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x)
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y)
      
      // If user moved more than 10px, consider it a swipe/scroll
      if (deltaX > 10 || deltaY > 10) {
        setShowTooltip(false)
        touchStartRef.current = null
      }
    }
  }

  // Handle touch end
  const handleTouchEnd = () => {
    touchStartRef.current = null
  }

  // Hide tooltip on scroll or touch outside
  useEffect(() => {
    if (!showTooltip) return

    const handleScroll = () => {
      setShowTooltip(false)
    }

    const handleTouchStartOutside = (e: TouchEvent) => {
      // Hide tooltip if user touches outside the badge
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setShowTooltip(false)
      }
    }

    // Listen to scroll events on window and parent containers
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('touchstart', handleTouchStartOutside, { passive: true })
    const parentElement = badgeRef.current?.closest('.repositories-grid')
    parentElement?.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('touchstart', handleTouchStartOutside)
      parentElement?.removeEventListener('scroll', handleScroll)
    }
  }, [showTooltip])

  return (
    <div className={`repository-tile repository-tile-${layout} ${repository.enabled ? '' : 'disabled'}`}>
      <div className="repository-tile-header">
        <div className="repository-info">
          <h4 className="repository-id">{repository.id}</h4>
          <a
            href={repository.url}
            target="_blank"
            rel="noopener noreferrer"
            className="repository-url"
          >
            {repository.url}
          </a>
        </div>
        <div className="repository-status">
          <span
            ref={badgeRef}
            className={`status-badge ${repository.enabled ? 'active' : 'inactive'}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {repository.error && (
              <span
                className={`status-badge-icon status-badge-icon-tooltip ${showTooltip ? 'tooltip-visible' : ''}`}
                data-tooltip={repository.error}
              >
                ⚠️
              </span>
            )}
            {repository.enabled ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="repository-tile-body">
        {repository.credential_id && (
          <div className="repository-meta">
            <span className="meta-label">Credential:</span>
            <span className="meta-value">{repository.credential_id}</span>
          </div>
        )}
        <div className="repository-meta">
          <span className="meta-label">Last Sync:</span>
          <span className="meta-value">{formatDate(repository.last_sync)}</span>
        </div>
      </div>

      <div className="repository-tile-actions">
        {onEdit && (
          <button
            className="action-btn edit-btn"
            onClick={() => onEdit(repository.id)}
            title="Edit"
          >
            <svg
              className="edit-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            {layout === 'wide' && <span>Edit</span>}
          </button>
        )}
        {repository.enabled && onSync && (
          <button
            className="action-btn sync-btn"
            onClick={() => onSync(repository.id)}
            title="Sync"
          >
            <svg
              className={`sync-icon ${inProgress ? 'rotating' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            {layout === 'wide' && <span>Sync</span>}
          </button>
        )}
        {onDelete && (
          <button
            className="action-btn delete-btn"
            onClick={() => onDelete(repository.id)}
            title="Delete"
          >
            <svg
              className="delete-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            {layout === 'wide' && <span>Delete</span>}
          </button>
        )}
      </div>
    </div>
  )
}

