import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Credential } from '../types'
import { apiClient } from '../api/client'
import { useNotifications } from '../contexts/NotificationContext'
import './CredentialManagementDialog.css'

export interface CredentialManagementDialogProps {
  isOpen: boolean
  onClose: () => void
  onCredentialsChange?: () => void
}

export const CredentialManagementDialog: React.FC<CredentialManagementDialogProps> = ({
  isOpen,
  onClose,
  onCredentialsChange,
}) => {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { showError, showInfo } = useNotifications()
  const [formData, setFormData] = useState<{
    id: string
    username: string
    password: string
    ssh_key: string | null
  }>({
    id: '',
    username: '',
    password: '',
    ssh_key: null,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [idError, setIdError] = useState<string | null>(null)

  // Load credentials when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadCredentials()
      resetForm()
    }
  }, [isOpen])

  const loadCredentials = async () => {
    try {
      setLoading(true)
      setError(null)
      const creds = await apiClient.getCredentials()
      setCredentials(creds)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load credentials'
      setError(errorMessage)
      showError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ id: '', username: '', password: '', ssh_key: null })
    setEditingId(null)
    setShowPassword(false)
    setIdError(null)
  }

  const handleEdit = (credential: Credential) => {
    setEditingId(credential.id)
    setFormData({
      id: credential.id, // Show ID but it's read-only for editing
      username: credential.username,
      password: '', // Don't show existing password
      ssh_key: null, // Don't show existing SSH key
    })
    setShowPassword(false)
    setIdError(null)
  }

  const handleCancelEdit = () => {
    resetForm()
  }

  const handleSave = async () => {
    if (!formData.username.trim()) {
      setError('Username is required')
      return
    }

    const hasPassword = formData.password.trim().length > 0
    const hasSshKey = formData.ssh_key && formData.ssh_key.trim().length > 0

    // For new credentials, require at least one authentication method
    if (!editingId && !hasPassword && !hasSshKey) {
      setError('At least one of Password or SSH Key is required')
      return
    }

    // For updates, if neither is provided and we're not keeping existing values, require at least one
    if (editingId && !hasPassword && !hasSshKey) {
      setError('At least one of Password or SSH Key must be provided')
      return
    }

    // Validate credential ID if provided (only for new credentials)
    if (!editingId && formData.id.trim()) {
      // Check if ID already exists in the current credentials list
      if (credentials.some((c) => c.id === formData.id.trim())) {
        setIdError('Credential ID already exists')
        setError('Credential ID already exists')
        return
      }
    }

    try {
      setSaving(true)
      setError(null)
      setIdError(null)

      const data: {
        username: string
        password: string
        ssh_key?: string | null
        id?: string | null
      } = {
        username: formData.username.trim(),
        password: hasPassword ? formData.password.trim() : '',
        ssh_key: hasSshKey && formData.ssh_key ? formData.ssh_key.trim() : (null as string | null | undefined),
      }

      // Only include ID for new credentials (not for updates)
      if (!editingId && formData.id.trim()) {
        data.id = formData.id.trim()
      }

      if (editingId) {
        await apiClient.updateCredential(editingId, data)
      } else {
        await apiClient.addCredential(data)
      }

      await loadCredentials()
      resetForm()
      onCredentialsChange?.()
      showInfo(editingId ? 'Credential updated successfully' : 'Credential added successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save credential'
      setError(errorMessage)
      showError(errorMessage)
      // Check if error is about ID collision
      if (errorMessage.includes('already exists')) {
        setIdError(errorMessage)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) {
      return
    }

    try {
      setDeletingId(id)
      setError(null)
      await apiClient.deleteCredential(id)
      await loadCredentials()
      onCredentialsChange?.()
      showInfo('Credential deleted successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete credential'
      setError(errorMessage)
      showError(errorMessage)
    } finally {
      setDeletingId(null)
    }
  }

  const handleClose = () => {
    resetForm()
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog-content credential-dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Manage Credentials</h2>
          <button className="dialog-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="dialog-body credential-dialog-body">
          {error && (
            <div className="dialog-error-message" role="alert">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Form for Add/Edit */}
          <div className="credential-form">
            <h3>{editingId ? 'Edit Credential' : 'Add New Credential'}</h3>
            {!editingId && (
              <div className="dialog-field">
                <label htmlFor="cred-id">Credential ID (Optional)</label>
                <input
                  id="cred-id"
                  type="text"
                  value={formData.id}
                  onChange={(e) => {
                    setFormData({ ...formData, id: e.target.value })
                    setIdError(null)
                  }}
                  placeholder="Auto-generated if not provided"
                  className={`dialog-input ${idError ? 'input-error' : ''}`}
                />
                {idError && (
                  <div className="dialog-field-error" role="alert">
                    {idError}
                  </div>
                )}
                <div className="dialog-field-hint">
                  Credential ID is optional. If not provided, a UUID will be auto-generated.
                </div>
              </div>
            )}
            {editingId && (
              <div className="dialog-field">
                <label htmlFor="cred-id-display">Credential ID</label>
                <input
                  id="cred-id-display"
                  type="text"
                  value={formData.id}
                  disabled
                  className="dialog-input-disabled"
                />
                <div className="dialog-field-hint">
                  Credential ID cannot be changed after creation.
                </div>
              </div>
            )}
            <div className="dialog-field">
              <label htmlFor="cred-username">Username</label>
              <input
                id="cred-username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter username"
                className="dialog-input"
              />
            </div>

            <div className="dialog-field">
              <label htmlFor="cred-password">
                Password <span className="field-hint">(semi-optional - required if no SSH key)</span>
                {editingId && <span className="field-hint"> - leave empty to keep current</span>}
              </label>
              <div className="password-input-wrapper">
                <input
                  id="cred-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingId ? 'Enter new password (optional)' : 'Enter password'}
                  className="dialog-input"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="dialog-field">
              <label htmlFor="cred-ssh-key">
                SSH Key <span className="field-hint">(semi-optional - required if no password)</span>
                {editingId && <span className="field-hint"> - leave empty to keep current</span>}
              </label>
              <textarea
                id="cred-ssh-key"
                value={formData.ssh_key ?? ''}
                onChange={(e) => setFormData({ ...formData, ssh_key: e.target.value || null })}
                placeholder="Paste SSH private key content"
                className="dialog-textarea"
                rows={6}
              />
              <div className="field-help">
                Paste the full SSH private key content here. It will be encrypted automatically.
              </div>
            </div>

            <div className="credential-form-actions">
              {editingId && (
                <button className="dialog-btn dialog-btn-secondary" onClick={handleCancelEdit}>
                  Cancel Edit
                </button>
              )}
              <button
                className="dialog-btn dialog-btn-primary"
                onClick={handleSave}
                disabled={
                  saving ||
                  !formData.username.trim() ||
                  (!editingId && !formData.password.trim() && !(formData.ssh_key && formData.ssh_key.trim()))
                }
              >
                {saving ? 'Saving...' : editingId ? 'Update Credential' : 'Add Credential'}
              </button>
            </div>
          </div>

          {/* List of existing credentials */}
          <div className="credentials-list">
            <h3>Existing Credentials</h3>
            {loading ? (
              <div className="loading-state">Loading credentials...</div>
            ) : credentials.length === 0 ? (
              <div className="empty-state">No credentials found</div>
            ) : (
              <div className="credentials-grid">
                {credentials.map((cred) => (
                  <div key={cred.id} className="credential-item">
                    <div className="credential-info">
                      <div className="credential-id">{cred.id}</div>
                      <div className="credential-username">{cred.username}</div>
                    </div>
                    <div className="credential-actions">
                      <button
                        className="credential-btn credential-btn-edit"
                        onClick={() => handleEdit(cred)}
                        disabled={editingId === cred.id || deletingId !== null}
                      >
                        Edit
                      </button>
                      <button
                        className="credential-btn credential-btn-delete"
                        onClick={() => handleDelete(cred.id)}
                        disabled={deletingId === cred.id || editingId !== null}
                      >
                        {deletingId === cred.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn dialog-btn-secondary" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

