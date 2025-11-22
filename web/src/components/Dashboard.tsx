import React, { useEffect, useState, useMemo } from 'react'
import { apiClient } from '../api/client'
import type { Repository, SearchFilters, Stats, TileLayout } from '../types'
import { Stats as StatsComponent } from './Stats'
import { FilterPanel } from './FilterPanel'
import { RepositoryTile } from './RepositoryTile'
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

// Extract base domain from URL
const extractBaseDomain = (url: string): string | null => {
  try {
    const urlObj = new URL(url)
    return urlObj.origin // Returns protocol + hostname (e.g., "https://github.com")
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/^(https?:\/\/)?([^\/]+)/)
    if (match) {
      const protocol = match[1] || 'https://'
      return protocol + match[2]
    }
    return null
  }
}

export const Dashboard: React.FC = () => {
  const [allRepositories, setAllRepositories] = useState<Repository[]>([])
  const [credentials, setCredentials] = useState<number>(0)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tileLayout, setTileLayout] = useState<TileLayout>('wide')
  const [syncingRepos, setSyncingRepos] = useState<Set<string>>(new Set())

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
      setCredentials(creds.length)
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


  // Extract unique suggestions for autocomplete (must be before early returns)
  const nameSuggestions = useMemo(
    () => Array.from(new Set(allRepositories.map((r) => r.id))),
    [allRepositories]
  )
  const urlSuggestions = useMemo(() => {
    const fullUrls = new Set<string>()
    const baseDomains = new Set<string>()
    
    // Separate full URLs and base domains
    allRepositories.forEach((r) => {
      fullUrls.add(r.url)
      
      const baseDomain = extractBaseDomain(r.url)
      if (baseDomain) {
        baseDomains.add(baseDomain)
      }
    })
    
    // Return base domains first, then full URLs
    return [...Array.from(baseDomains), ...Array.from(fullUrls)]
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
    totalCredentials: credentials,
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

  // Initial loading - show full dashboard loading state
  if (initialLoading) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <h1>GitSafe - Repository Management</h1>
        </header>
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
      <header className="dashboard-header">
        <h1>GitSafe - Repository Management</h1>
      </header>
      <div className="dashboard-content">
        <StatsComponent {...stats} />
        <FilterPanel
          onFilterChange={setFilters}
          nameSuggestions={nameSuggestions}
          urlSuggestions={urlSuggestions}
        />
        <div className="dashboard-controls">
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
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

