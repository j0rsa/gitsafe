import React, { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import type { Repository, SearchFilters, Stats } from '../types'
import { Stats as StatsComponent } from './Stats'
import { FilterPanel } from './FilterPanel'
import { RepositoryTile } from './RepositoryTile'
import './Dashboard.css'

export const Dashboard: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [credentials, setCredentials] = useState<number>(0)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [repos, creds] = await Promise.all([
        apiClient.getRepositories(filters),
        apiClient.getCredentials(),
      ])
      setRepositories(repos)
      setCredentials(creds.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filters])

  const stats: Stats = {
    totalRepositories: repositories.length,
    activeRepositories: repositories.filter((r) => r.enabled).length,
    inactiveRepositories: repositories.filter((r) => !r.enabled).length,
    totalCredentials: credentials,
  }

  const handleSync = async (id: string) => {
    try {
      await apiClient.syncRepository(id)
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sync repository')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this repository?')) {
      return
    }
    try {
      await apiClient.deleteRepository(id)
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete repository')
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <div className="error-message">Error: {error}</div>
        <button onClick={loadData} className="retry-btn">
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
        <FilterPanel onFilterChange={setFilters} />
        <div className="repositories-grid">
          {repositories.length === 0 ? (
            <div className="empty-state">
              <p>No repositories found</p>
            </div>
          ) : (
            repositories.map((repo) => (
              <RepositoryTile
                key={repo.id}
                repository={repo}
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

