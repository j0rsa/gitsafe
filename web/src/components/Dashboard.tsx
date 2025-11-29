import React, { useEffect, useState, useMemo } from 'react'
import { apiClient } from '../api/client'
import type { Repository, Credential, SearchFilters, Stats, TileLayout } from '../types'
import { extractHost, extractOrg } from '../utils'
import { Stats as StatsComponent } from './Stats'
import { FilterPanel } from './FilterPanel'
import { RepositoryTile } from './RepositoryTile'
import { RepositoryEditDialog } from './RepositoryEditDialog'
import { RepositoryAddDialog } from './RepositoryAddDialog'
import { BatchAddDialog } from './BatchAddDialog'
import { CredentialManagementDialog } from './CredentialManagementDialog'
import { ThemeSelector } from './ThemeSelector'
import { useNotifications } from '../contexts/NotificationContext'
import './Dashboard.css'

// Fuzzy matching function - checks if query characters appear in order in the text
const fuzzyMatch = (text: string, query: string): boolean => {
  if (!query) return true
  
  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()
  
  // Exact match (includes) gets highest priority
  if (textLower.includes(queryLower)) return true
  
  // Fuzzy match: all query characters must appear in order
  let queryIndex = 0
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++
    }
  }
  
  return queryIndex === queryLower.length
}


export interface DashboardProps {
  onLogout?: () => void
}

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [allRepositories, setAllRepositories] = useState<Repository[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [filters, setFilters] = useState<SearchFilters>({})
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tileLayout, setTileLayout] = useState<TileLayout>('wide')
  const [syncingRepos, setSyncingRepos] = useState<Set<string>>(new Set())
  const [editingRepoId, setEditingRepoId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showBatchAddDialog, setShowBatchAddDialog] = useState(false)
  const [showCredentialDialog, setShowCredentialDialog] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { showError, showInfo } = useNotifications()

  // Load initial data (all repositories)
  const loadInitialData = async () => {
    try {
      setInitialLoading(true)
      setError(null)
      const [repos, creds] = await Promise.all([
        apiClient.getRepositories({}),
        apiClient.getCredentials(),
      ])
      setAllRepositories(repos)
      setCredentials(creds)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data'
      setError(errorMessage)
      showError(errorMessage)
    } finally {
      setInitialLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadInitialData()
  }, [])

  // Detect mobile screen size and auto-switch to square layout
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      // Automatically switch to square layout on mobile
      if (mobile) {
        setTileLayout('square')
      }
    }

    // Check on mount
    checkMobile()

    // Listen for resize events
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])


  // Extract unique suggestions for autocomplete (must be before early returns)
  const nameSuggestions = useMemo(
    () => Array.from(new Set(allRepositories.map((r) => r.id))),
    [allRepositories]
  )
  
  const hostSuggestions = useMemo(() => {
    const hosts = new Set<string>()
    allRepositories.forEach((r) => {
      const host = extractHost(r.url)
      if (host) {
        hosts.add(host)
      }
    })
    return Array.from(hosts).sort()
  }, [allRepositories])
  
  const orgSuggestions = useMemo(() => {
    const orgs = new Set<string>()
    allRepositories.forEach((r) => {
      const org = extractOrg(r.url)
      if (org) {
        orgs.add(org)
      }
    })
    return Array.from(orgs).sort()
  }, [allRepositories])
  
  // URL suggestions for RepositoryAddDialog (for autocomplete when adding new repos)
  const urlSuggestions = useMemo(() => {
    return allRepositories.map((r) => r.url)
  }, [allRepositories])

  // Client-side filtering
  const filteredRepositories = useMemo(() => {
    return allRepositories.filter((repo) => {
      // Filter by name (repository id) with fuzzy matching
      if (filters.name) {
        if (!fuzzyMatch(repo.id, filters.name)) return false
      }

      // Filter by host with fuzzy matching
      if (filters.host) {
        const repoHost = extractHost(repo.url)
        if (!repoHost || !fuzzyMatch(repoHost, filters.host)) return false
      }

      // Filter by org/user with fuzzy matching
      if (filters.org) {
        const repoOrg = extractOrg(repo.url)
        if (!repoOrg || !fuzzyMatch(repoOrg, filters.org)) return false
      }

      // Filter by error state
      if (filters.has_error !== undefined) {
        // A repository has an error if error is a non-empty string
        // New repositories should have error as null or undefined
        const hasError = repo.error != null && repo.error.trim() !== ''
        if (filters.has_error !== hasError) return false
      }

      // Filter by enabled/active state
      if (filters.enabled !== undefined) {
        if (filters.enabled !== repo.enabled) return false
      }

      return true
    })
  }, [allRepositories, filters])

  const stats: Stats = useMemo(() => {
    const totalSize = allRepositories.reduce((sum, repo) => {
      return sum + (repo.size || 0)
    }, 0)

    return {
      totalRepositories: allRepositories.length,
      activeRepositories: allRepositories.filter((r) => r.enabled).length,
      inactiveRepositories: allRepositories.filter((r) => !r.enabled).length,
      totalCredentials: credentials.length,
      totalSize,
    }
  }, [allRepositories, credentials.length])

  const handleSync = async (id: string) => {
    try {
      setSyncingRepos((prev) => new Set(prev).add(id))
      const result = await apiClient.syncRepository(id)
      // Reload data to get updated repository state
      await loadInitialData()
      
      // Display sync status message
      showInfo(result.message)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync repository'
      showError(errorMessage)
    } finally {
      setSyncingRepos((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this repository?')) {
      return
    }
    try {
      await apiClient.deleteRepository(id)
      // Reload data to remove deleted repository
      await loadInitialData()
      showInfo('Repository deleted successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete repository'
      showError(errorMessage)
    }
  }

  const handleEdit = (id: string) => {
    setEditingRepoId(id)
  }

  const handleSaveRepository = async (updates: { enabled: boolean; credential_id: string | null }) => {
    if (!editingRepoId) return
    
    try {
      await apiClient.updateRepository(editingRepoId, updates)
      await loadInitialData()
      setEditingRepoId(null)
    } catch (err) {
      throw err
    }
  }

  const handleAddRepository = async (data: { url: string; credential_id: string | null; id: string | null }) => {
    try {
      const newRepo = await apiClient.addRepository(data)
      await loadInitialData()
      setShowAddDialog(false)
      
      // Immediately sync the newly added repository
      if (newRepo.id) {
        try {
          setSyncingRepos((prev) => new Set(prev).add(newRepo.id))
          const syncResult = await apiClient.syncRepository(newRepo.id)
          await loadInitialData() // Reload to get updated sync status
          
          // Display sync status message
          showInfo(syncResult.message)
        } catch (syncErr) {
          // Sync error is not critical - repository was added successfully
          // The error will be shown in the repository tile
          console.error('Failed to sync repository after adding:', syncErr)
          await loadInitialData() // Still reload to show the repository
        } finally {
          setSyncingRepos((prev) => {
            const next = new Set(prev)
            next.delete(newRepo.id)
            return next
          })
        }
      }
    } catch (err) {
      throw err
    }
  }

  const handleBatchAdd = async (
    repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
    onProgress?: (current: number, total: number) => void
  ) => {
    const addedRepos: string[] = []
    const errors: string[] = []

    // Add repositories sequentially
    for (let i = 0; i < repositories.length; i++) {
      const repo = repositories[i]
      try {
        const newRepo = await apiClient.addRepository(repo)
        if (newRepo.id) {
          addedRepos.push(newRepo.id)
        }
        // Reload data after each addition to get updated state
        await loadInitialData()
        // Update progress (adding phase)
        if (onProgress) {
          onProgress(i + 1, repositories.length)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : `Failed to add ${repo.url}`
        errors.push(`${repo.url}: ${errorMessage}`)
        console.error(`Failed to add repository ${repo.url}:`, err)
        // Still update progress even on error
        if (onProgress) {
          onProgress(i + 1, repositories.length)
        }
      }
    }

    if (errors.length > 0) {
      const errorMsg = `Failed to add ${errors.length} repository/repositories:\n${errors.join('\n')}`
      showError(errorMsg)
    }

    if (addedRepos.length === 0) {
      throw new Error('No repositories were added successfully')
    }

    // Sync all successfully added repositories
    const syncPromises = addedRepos.map(async (repoId) => {
      try {
        setSyncingRepos((prev) => new Set(prev).add(repoId))
        const syncResult = await apiClient.syncRepository(repoId)
        await loadInitialData() // Reload after each sync
        return { repoId, success: true, message: syncResult.message }
      } catch (syncErr) {
        console.error(`Failed to sync repository ${repoId}:`, syncErr)
        await loadInitialData() // Still reload
        return { repoId, success: false, error: syncErr instanceof Error ? syncErr.message : 'Unknown error' }
      } finally {
        setSyncingRepos((prev) => {
          const next = new Set(prev)
          next.delete(repoId)
          return next
        })
      }
    })

    // Wait for all syncs to complete
    const syncResults = await Promise.all(syncPromises)
    const successfulSyncs = syncResults.filter(r => r.success).length
    const failedSyncs = syncResults.filter(r => !r.success)

    if (failedSyncs.length > 0) {
      showError(`Added ${addedRepos.length} repositories, but ${failedSyncs.length} sync(s) failed. Check repository tiles for details.`)
    } else {
      showInfo(`Successfully added and synced ${successfulSyncs} repository/repositories`)
    }

    setShowBatchAddDialog(false)
  }

  const editingRepository = editingRepoId
    ? allRepositories.find((r) => r.id === editingRepoId)
    : null

  // Initial loading - show full dashboard loading state
  if (initialLoading) {
    return (
      <div className="dashboard">
        <div className="dashboard-content">
          <div className="dashboard-loading">
            <div className="loading-spinner-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">Loading repositories...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && initialLoading) {
    return (
      <div className="dashboard-error">
        <div className="error-message">Error: {error}</div>
        <button onClick={loadInitialData} className="retry-btn">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>GitSafe</h1>
        <div className="dashboard-header-actions">
          <ThemeSelector />
          {onLogout && (
            <button className="logout-btn" onClick={onLogout} aria-label="Logout" title="Logout">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 11L14 8L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="dashboard-content">
        <StatsComponent {...stats} />
        <FilterPanel
          onFilterChange={setFilters}
          nameSuggestions={nameSuggestions}
          hostSuggestions={hostSuggestions}
          orgSuggestions={orgSuggestions}
          inactiveCount={allRepositories.filter((r) => !r.enabled).length}
          erroredCount={allRepositories.filter((r) => r.error != null && r.error.trim() !== '').length}
        />
        <div className="dashboard-controls">
          <div className="dashboard-controls-left">
            <button
              className="add-repository-btn"
              onClick={() => setShowAddDialog(true)}
            >
              + Add Repository
            </button>
            <button
              className="add-repository-btn"
              onClick={() => setShowBatchAddDialog(true)}
            >
              + Batch Add Repositories
            </button>
            <button
              className="manage-credentials-btn"
              onClick={() => setShowCredentialDialog(true)}
            >
              Manage Credentials
            </button>
          </div>
          {!isMobile && (
            <div className="tile-layout-selector">
              <label htmlFor="tile-layout">Tile Layout:</label>
              <select
                id="tile-layout"
                value={tileLayout}
                onChange={(e) => setTileLayout(e.target.value as TileLayout)}
                className="layout-select"
              >
                <option value="wide">Wide</option>
                <option value="square">Square</option>
              </select>
            </div>
          )}
        </div>
        <div className={`repositories-grid repositories-grid-${tileLayout}`}>
          {filteredRepositories.length === 0 ? (
            <div className="empty-state">
              <p>No repositories found</p>
            </div>
          ) : (
            filteredRepositories.map((repo) => (
              <RepositoryTile
                key={repo.id}
                repository={repo}
                layout={tileLayout}
                inProgress={syncingRepos.has(repo.id)}
                onSync={handleSync}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))
          )}
        </div>
        {editingRepository && (
          <RepositoryEditDialog
            repository={editingRepository}
            credentials={credentials}
            isOpen={true}
            onClose={() => setEditingRepoId(null)}
            onSave={handleSaveRepository}
          />
        )}
        <RepositoryAddDialog
          credentials={credentials}
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={handleAddRepository}
          urlSuggestions={urlSuggestions}
        />
        <BatchAddDialog
          credentials={credentials}
          isOpen={showBatchAddDialog}
          onClose={() => setShowBatchAddDialog(false)}
          onBatchAdd={handleBatchAdd}
        />
        <CredentialManagementDialog
          isOpen={showCredentialDialog}
          onClose={() => setShowCredentialDialog(false)}
          onCredentialsChange={loadInitialData}
        />
      </div>
    </div>
  )
}

