import React from 'react'
import type { Repository, TileLayout } from '../types'
import './RepositoryTile.css'

export interface RepositoryTileProps {
  repository: Repository
  layout?: TileLayout
  inProgress?: boolean
  onSync?: (id: string) => void
  onDelete?: (id: string) => void
}

export const RepositoryTile: React.FC<RepositoryTileProps> = ({
  repository,
  layout = 'wide',
  inProgress = false,
  onSync,
  onDelete,
}) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    try {
      const date = new Date(dateString)
      return date.toLocaleString()
    } catch {
      return 'Invalid date'
    }
  }

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
          <span className={`status-badge ${repository.enabled ? 'active' : 'inactive'}`}>
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
        {repository.error && (
          <div className="repository-error">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{repository.error}</span>
          </div>
        )}
      </div>

      <div className="repository-tile-actions">
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

