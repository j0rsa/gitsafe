import React, { useEffect, useState, useMemo } from 'react'
import { apiClient } from '../api/client'
import type { Repository, Credential, SearchFilters, Stats, TileLayout } from '../types'
import { Stats as StatsComponent } from './Stats'
import { FilterPanel } from './FilterPanel'
import { RepositoryTile } from './RepositoryTile'
import { RepositoryEditDialog } from './RepositoryEditDialog'
import { RepositoryAddDialog } from './RepositoryAddDialog'
import { CredentialManagementDialog } from './CredentialManagementDialog'
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

// Extract base domain from URL (with protocol, e.g., "https://github.com")
const extractBaseDomain = (url: string): string | null => {
  try {
    const urlObj = new URL(url)
    return urlObj.origin // Returns protocol + hostname (e.g., "https://github.com")
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/^(https?:\/\/)([^\/]+)/)
    if (match) {
      return match[1] + match[2] // protocol + domain
    }
    return null
  }
}

// Extract base domain with user/org (with protocol, e.g., "https://github.com/example")
const extractBaseDomainWithUser = (url: string): string | null => {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    if (pathParts.length >= 1) {
      // Return origin + first path segment (user/org) with protocol
      return `${urlObj.origin}/${pathParts[0]}`
    }
    return null
  } catch {
    // If URL parsing fails, try to extract manually
    const match = url.match(/^(https?:\/\/[^\/]+)\/([^\/]+)/)
    if (match) {
      return `${match[1]}/${match[2]}` // protocol + hostname/user
    }
    return null
  }
}

export const Dashboard: React.FC = () => {
  const [allRepositories, setAllRepositories] = useState<Repository[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [filters, setFilters] = useState<SearchFilters>({})
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tileLayout, setTileLayout] = useState<TileLayout>('wide')
  const [syncingRepos, setSyncingRepos] = useState<Set<string>>(new Set())
  const [editingRepoId, setEditingRepoId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCredentialDialog, setShowCredentialDialog] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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
      setError(err instanceof Error ? err.message : 'Failed to load data')
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
  const urlSuggestions = useMemo(() => {
    const baseDomains = new Set<string>()
    const baseDomainsWithUser = new Set<string>()
    
    // Extract base domains and base domains with users/orgs
    allRepositories.forEach((r) => {
      const baseDomain = extractBaseDomain(r.url)
      if (baseDomain) {
        baseDomains.add(baseDomain)
      }
      
      const baseDomainWithUser = extractBaseDomainWithUser(r.url)
      if (baseDomainWithUser) {
        baseDomainsWithUser.add(baseDomainWithUser)
      }
    })
    
    // Return base domains first, then base domains with users/orgs
    // Do NOT include full repository URLs
    return [...Array.from(baseDomains), ...Array.from(baseDomainsWithUser)]
  }, [allRepositories])

  // Client-side filtering
  const filteredRepositories = useMemo(() => {
    return allRepositories.filter((repo) => {
      // Filter by name (repository id) with fuzzy matching
      if (filters.name) {
        if (!fuzzyMatch(repo.id, filters.name)) return false
      }

      // Filter by URL with fuzzy matching (check both full URL and base domain)
      if (filters.url) {
        const urlMatch = fuzzyMatch(repo.url, filters.url)
        const baseDomain = extractBaseDomain(repo.url)
        const domainMatch = baseDomain ? fuzzyMatch(baseDomain, filters.url) : false
        
        if (!urlMatch && !domainMatch) return false
      }

      // Filter by error state
      if (filters.has_error !== undefined) {
        const hasError = repo.error !== null && repo.error !== undefined
        if (filters.has_error !== hasError) return false
      }

      // Filter by enabled/active state
      if (filters.enabled !== undefined) {
        if (filters.enabled !== repo.enabled) return false
      }

      return true
    })
  }, [allRepositories, filters])

  const stats: Stats = {
    totalRepositories: allRepositories.length,
    activeRepositories: allRepositories.filter((r) => r.enabled).length,
    inactiveRepositories: allRepositories.filter((r) => !r.enabled).length,
    totalCredentials: credentials.length,
  }

  const handleSync = async (id: string) => {
    try {
      setSyncingRepos((prev) => new Set(prev).add(id))
      await apiClient.syncRepository(id)
      // Reload data to get updated repository state
      await loadInitialData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sync repository')
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete repository')
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

  const handleAddRepository = async (data: { url: string; credential_id: string | null }) => {
    try {
      await apiClient.addRepository(data)
      await loadInitialData()
      setShowAddDialog(false)
    } catch (err) {
      throw err
    }
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
      <div className="dashboard-content">
        <StatsComponent {...stats} />
        <FilterPanel
          onFilterChange={setFilters}
          nameSuggestions={nameSuggestions}
          urlSuggestions={urlSuggestions}
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
        <CredentialManagementDialog
          isOpen={showCredentialDialog}
          onClose={() => setShowCredentialDialog(false)}
          onCredentialsChange={loadInitialData}
        />
      </div>
    </div>
  )
}

