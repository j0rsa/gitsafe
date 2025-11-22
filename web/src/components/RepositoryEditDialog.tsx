import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Repository, Credential } from '../types'
import { Autocomplete } from './Autocomplete'
import './RepositoryEditDialog.css'

export interface RepositoryEditDialogProps {
  repository: Repository
  credentials: Credential[]
  isOpen: boolean
  onClose: () => void
  onSave: (updates: { enabled: boolean; credential_id: string | null }) => Promise<void>
}

export const RepositoryEditDialog: React.FC<RepositoryEditDialogProps> = ({
  repository,
  credentials,
  isOpen,
  onClose,
  onSave,
}) => {
  const [enabled, setEnabled] = useState(repository.enabled)
  const [credentialId, setCredentialId] = useState(repository.credential_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credentialError, setCredentialError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setEnabled(repository.enabled)
      setCredentialId(repository.credential_id || '')
      setError(null)
      setCredentialError(null)
    }
  }, [isOpen, repository])

  const credentialSuggestions = credentials.map((c) => c.id)

  // Handle credential ID change with validation
  const handleCredentialIdChange = (value: string) => {
    setCredentialId(value)
    setCredentialError(null)
    
    // If a value is entered, validate it's in the suggestions list
    if (value.trim() && !credentialSuggestions.includes(value.trim())) {
      setCredentialError('Please select a credential from the list')
    }
  }

  const handleSave = async () => {
    // Validate credential ID if provided
    if (credentialId.trim()) {
      if (!credentialSuggestions.includes(credentialId.trim())) {
        setCredentialError('Please select a valid credential from the list')
        setError('Invalid credential ID. Please select a credential from the dropdown.')
        return
      }
    }

    try {
      setSaving(true)
      setError(null)
      setCredentialError(null)
      await onSave({
        enabled,
        credential_id: credentialId.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update repository')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEnabled(repository.enabled)
    setCredentialId(repository.credential_id || '')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="dialog-overlay" onClick={handleCancel}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Edit Repository</h2>
          <button className="dialog-close" onClick={handleCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="dialog-body">
          <div className="dialog-field">
            <label>Repository ID</label>
            <input type="text" value={repository.id} disabled className="dialog-input-disabled" />
          </div>

          <div className="dialog-field">
            <label>URL</label>
            <input type="text" value={repository.url} disabled className="dialog-input-disabled" />
          </div>

          <div className="dialog-field">
            <label>Status</label>
            <div className="dialog-toggle-group">
              <button
                className={`dialog-toggle-btn ${enabled ? 'active' : ''}`}
                onClick={() => setEnabled(true)}
              >
                Active
              </button>
              <button
                className={`dialog-toggle-btn ${!enabled ? 'active' : ''}`}
                onClick={() => setEnabled(false)}
              >
                Inactive
              </button>
            </div>
          </div>

          <div className="dialog-field">
            <Autocomplete
              id="credential-select"
              label="Credential"
              placeholder="Select or type credential ID..."
              value={credentialId}
              onChange={handleCredentialIdChange}
              suggestions={credentialSuggestions}
              maxSuggestions={10}
              moveCursorToEnd={false}
              openOnEmptyFocus={true}
            />
            {credentialError && (
              <div className="dialog-field-error" role="alert">
                {credentialError}
              </div>
            )}
            <button
              className="dialog-clear-btn"
              onClick={() => {
                setCredentialId('')
                setCredentialError(null)
              }}
              type="button"
            >
              Clear Credential
            </button>
          </div>

          {repository.error && (
            <div className="dialog-error-section">
              <label>Last Error</label>
              <div className="dialog-error-display">
                <span className="error-icon">⚠️</span>
                <span className="error-text">{repository.error}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="dialog-error-message">
              {error}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn dialog-btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button
            className="dialog-btn dialog-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

