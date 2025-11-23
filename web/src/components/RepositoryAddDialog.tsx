import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Credential } from '../types'
import { Autocomplete } from './Autocomplete'
import { repoNameFromUrl } from '../utils'
import { useNotifications } from '../contexts/NotificationContext'
import './RepositoryEditDialog.css'

export interface RepositoryAddDialogProps {
  credentials: Credential[]
  isOpen: boolean
  onClose: () => void
  onSave: (data: { url: string; credential_id: string | null; id: string | null }) => Promise<void>
  urlSuggestions?: string[]
}

export const RepositoryAddDialog: React.FC<RepositoryAddDialogProps> = ({
  credentials,
  isOpen,
  onClose,
  onSave,
  urlSuggestions = [],
}) => {
  const [url, setUrl] = useState('')
  const [repositoryId, setRepositoryId] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credentialError, setCredentialError] = useState<string | null>(null)
  const [idError, setIdError] = useState<string | null>(null)
  const { showError, showInfo } = useNotifications()

  useEffect(() => {
    if (isOpen) {
      setUrl('')
      setRepositoryId('')
      setCredentialId('')
      setError(null)
      setCredentialError(null)
      setIdError(null)
    }
  }, [isOpen])

  // Calculate repository ID from URL when URL changes
  useEffect(() => {
    if (url.trim()) {
      try {
        new URL(url) // Validate URL
        const calculatedId = repoNameFromUrl(url)
        setRepositoryId(calculatedId)
        setIdError(null)
      } catch {
        // Invalid URL, don't update ID
      }
    } else {
      setRepositoryId('')
    }
  }, [url])

  // Clear error when user starts typing in URL field
  const handleUrlChange = (value: string) => {
    setUrl(value)
    if (error) {
      setError(null)
    }
  }

  // Handle repository ID change
  const handleRepositoryIdChange = (value: string) => {
    setRepositoryId(value)
    setIdError(null)
  }

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
    // Validate URL
    if (!url.trim()) {
      setError('Repository URL is required')
      return
    }

    // Basic URL validation
    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL (e.g., https://github.com/user/repo.git)')
      return
    }

    // Validate repository ID
    if (!repositoryId.trim()) {
      setIdError('Repository ID is required')
      setError('Repository ID is required')
      return
    }

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
      setIdError(null)
      await onSave({
        url: url.trim(),
        credential_id: credentialId.trim() || null,
        id: repositoryId.trim() || null,
      })
      // Only close on success
      showInfo('Repository added successfully')
      onClose()
    } catch (err) {
      // Extract error message
      let errorMessage = 'Failed to add repository'
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      setError(errorMessage)
      showError(errorMessage)
      // Keep dialog open so user can fix the error
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setUrl('')
    setRepositoryId('')
    setCredentialId('')
    setError(null)
    setIdError(null)
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="dialog-overlay" onClick={handleCancel}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Add Repository</h2>
          <button className="dialog-close" onClick={handleCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="dialog-body">
          <div className="dialog-field">
            <Autocomplete
              id="url-input"
              label="Repository URL"
              placeholder="https://github.com/user/repository.git"
              value={url}
              onChange={handleUrlChange}
              suggestions={urlSuggestions}
              maxSuggestions={10}
              moveCursorToEnd={true}
              openOnEmptyFocus={false}
            />
          </div>

          <div className="dialog-field">
            <label htmlFor="repository-id-input">Repository ID</label>
            <input
              id="repository-id-input"
              type="text"
              value={repositoryId}
              onChange={(e) => handleRepositoryIdChange(e.target.value)}
              placeholder="Auto-generated from URL"
              className={idError ? 'input-error' : ''}
            />
            {idError && (
              <div className="dialog-field-error" role="alert">
                {idError}
              </div>
            )}
            <div className="dialog-field-hint">
              Repository ID is automatically calculated from the URL. You can edit it if needed.
            </div>
          </div>

          <div className="dialog-field">
            <Autocomplete
              id="credential-select"
              label="Credential (Optional)"
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
            {credentialId && (
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
            )}
          </div>

          {error && (
            <div className="dialog-error-message" role="alert">
              <strong>Error:</strong> {error}
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
            disabled={saving || !url.trim()}
          >
            {saving ? 'Adding...' : 'Add Repository'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

