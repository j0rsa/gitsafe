import React from 'react'
import type { Repository } from '../types'
import './RepositoryTile.css'

export interface RepositoryTileProps {
  repository: Repository
  onSync?: (id: string) => void
  onDelete?: (id: string) => void
}

export const RepositoryTile: React.FC<RepositoryTileProps> = ({
  repository,
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
    <div className={`repository-tile ${repository.enabled ? '' : 'disabled'}`}>
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
          >
            Sync
          </button>
        )}
        {onDelete && (
          <button
            className="action-btn delete-btn"
            onClick={() => onDelete(repository.id)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

