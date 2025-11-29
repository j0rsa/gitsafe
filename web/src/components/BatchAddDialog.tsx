import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Credential } from '../types'
import { Autocomplete } from './Autocomplete'
import { repoNameFromUrl, isSshUrl } from '../utils'
import { useNotifications } from '../contexts/NotificationContext'
import './RepositoryEditDialog.css'

export interface BatchAddDialogProps {
  credentials: Credential[]
  isOpen: boolean
  onClose: () => void
  onBatchAdd: (
    repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
    onProgress?: (current: number, total: number) => void
  ) => Promise<void>
}

export const BatchAddDialog: React.FC<BatchAddDialogProps> = ({
  credentials,
  isOpen,
  onClose,
  onBatchAdd,
}) => {
  const [urls, setUrls] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credentialError, setCredentialError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const { showError, showInfo } = useNotifications()

  useEffect(() => {
    if (isOpen) {
      setUrls('')
      setCredentialId('')
      setError(null)
      setCredentialError(null)
      setProgress(null)
    }
  }, [isOpen])

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

  const parseUrls = (urlText: string): string[] => {
    return urlText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
  }

  const validateUrl = (url: string): string | null => {
    const urlIsHttp = url.startsWith('http://') || url.startsWith('https://')
    const urlIsSsh = isSshUrl(url)
    
    if (!urlIsHttp && !urlIsSsh) {
      return 'Invalid URL format. Use HTTP/HTTPS or SSH format (git@host:path)'
    }
    
    if (urlIsHttp) {
      try {
        new URL(url)
      } catch {
        return 'Invalid HTTP/HTTPS URL format'
      }
    }

    return null
  }

  const handleBatchAdd = async () => {
    // Validate URLs
    if (!urls.trim()) {
      setError('Please enter at least one repository URL')
      return
    }

    const urlList = parseUrls(urls)
    if (urlList.length === 0) {
      setError('Please enter at least one repository URL')
      return
    }

    // Validate all URLs
    const urlErrors: string[] = []
    urlList.forEach((url, index) => {
      const error = validateUrl(url)
      if (error) {
        urlErrors.push(`Line ${index + 1}: ${error}`)
      }
    })

    if (urlErrors.length > 0) {
      setError(`Invalid URLs:\n${urlErrors.join('\n')}`)
      return
    }

    // Validate credential ID if provided
    if (credentialId.trim()) {
      if (!credentialSuggestions.includes(credentialId.trim())) {
        setCredentialError('Please select a valid credential from the list')
        setError('Invalid credential ID. Please select a credential from the dropdown.')
        return
      }

      // Validate credential type matches URL types
      const selectedCredential = credentials.find(c => c.id === credentialId.trim())
      if (selectedCredential) {
        // Check if any URL is HTTP/HTTPS and credential is SSH-only
        const hasHttpUrl = urlList.some(url => {
          const urlIsHttp = url.startsWith('http://') || url.startsWith('https://')
          return urlIsHttp && !isSshUrl(url)
        })

        if (hasHttpUrl && selectedCredential.is_ssh_key) {
          setCredentialError('HTTP/HTTPS URLs require credentials with username/password')
          setError('HTTP/HTTPS URLs require credentials with username/password. Please select a credential without SSH key or use SSH URLs only.')
          return
        }
      }
    }

    try {
      setProcessing(true)
      setError(null)
      setCredentialError(null)
      
      // Generate repository data with auto-generated IDs
      const repositories = urlList.map(url => ({
        url: url.trim(),
        credential_id: credentialId.trim() || null,
        id: repoNameFromUrl(url.trim()) || null,
      }))

      setProgress({ current: 0, total: repositories.length })
      await onBatchAdd(repositories, (current, total) => {
        setProgress({ current, total })
      })
      
      showInfo(`Successfully added ${repositories.length} repository/repositories`)
      onClose()
    } catch (err) {
      // Extract error message
      let errorMessage = 'Failed to add repositories'
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      setError(errorMessage)
      showError(errorMessage)
      // Keep dialog open so user can fix the error
    } finally {
      setProcessing(false)
      setProgress(null)
    }
  }

  const handleCancel = () => {
    setUrls('')
    setCredentialId('')
    setError(null)
    setCredentialError(null)
    setProgress(null)
    onClose()
  }

  if (!isOpen) return null

  const urlList = parseUrls(urls)
  const urlCount = urlList.length

  return createPortal(
    <div className="dialog-overlay" onClick={handleCancel}>
      <div className="dialog-content batch-add-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Batch Add Repositories</h2>
          <button className="dialog-close" onClick={handleCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="dialog-body">
          <div className="dialog-field">
            <label htmlFor="urls-textarea">
              Repository URLs (one per line)
              {urlCount > 0 && <span className="url-count"> ({urlCount} URL{urlCount !== 1 ? 's' : ''})</span>}
            </label>
            <textarea
              id="urls-textarea"
              value={urls}
              onChange={(e) => {
                setUrls(e.target.value)
                setError(null)
              }}
              placeholder="https://github.com/user/repo1.git&#10;https://github.com/user/repo2.git&#10;git@github.com:user/repo3.git"
              rows={10}
              className={error && error.includes('Invalid URLs') ? 'input-error' : ''}
              disabled={processing}
            />
            <div className="dialog-field-hint">
              Enter one repository URL per line. Supports both HTTP/HTTPS and SSH URLs.
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
                disabled={processing}
              >
                Clear Credential
              </button>
            )}
            <div className="dialog-field-hint">
              The selected credential will be applied to all repositories. Leave empty if repositories don't require authentication.
            </div>
          </div>

          {progress && (
            <div className="batch-progress">
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="progress-text">
                Processing {progress.current} of {progress.total} repositories...
              </div>
            </div>
          )}

          {error && (
            <div className="dialog-error-message" role="alert">
              <strong>Error:</strong> 
              <pre style={{ whiteSpace: 'pre-wrap', margin: '0.5em 0 0 0' }}>{error}</pre>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button 
            className="dialog-btn dialog-btn-secondary" 
            onClick={handleCancel}
            disabled={processing}
          >
            Cancel
          </button>
          <button
            className="dialog-btn dialog-btn-primary"
            onClick={handleBatchAdd}
            disabled={processing || !urls.trim()}
          >
            {processing ? `Adding... (${progress?.current || 0}/${progress?.total || 0})` : `Add ${urlCount > 0 ? urlCount : ''} Repository${urlCount !== 1 ? 'ies' : ''}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

