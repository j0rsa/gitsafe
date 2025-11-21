import React, { useState } from 'react'
import type { SearchFilters } from '../types'
import './FilterPanel.css'

export interface FilterPanelProps {
  onFilterChange: (filters: SearchFilters) => void
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ onFilterChange }) => {
  const [nameFilter, setNameFilter] = useState('')
  const [urlFilter, setUrlFilter] = useState('')
  const [errorFilter, setErrorFilter] = useState<boolean | undefined>(undefined)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNameFilter(value)
    onFilterChange({
      name: value || undefined,
      url: urlFilter || undefined,
      has_error: errorFilter,
    })
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUrlFilter(value)
    onFilterChange({
      name: nameFilter || undefined,
      url: value || undefined,
      has_error: errorFilter,
    })
  }

  const handleErrorFilterChange = (value: boolean | undefined) => {
    setErrorFilter(value)
    onFilterChange({
      name: nameFilter || undefined,
      url: urlFilter || undefined,
      has_error: value,
    })
  }

  const clearFilters = () => {
    setNameFilter('')
    setUrlFilter('')
    setErrorFilter(undefined)
    onFilterChange({})
  }

  const hasActiveFilters = nameFilter || urlFilter || errorFilter !== undefined

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <h3>Filters</h3>
        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear All
          </button>
        )}
      </div>
      <div className="filter-controls">
        <div className="filter-group">
          <label htmlFor="name-filter">Name/ID</label>
          <input
            id="name-filter"
            type="text"
            placeholder="Filter by repository name or ID..."
            value={nameFilter}
            onChange={handleNameChange}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label htmlFor="url-filter">URL</label>
          <input
            id="url-filter"
            type="text"
            placeholder="Filter by URL (partial match)..."
            value={urlFilter}
            onChange={handleUrlChange}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label>Error State</label>
          <div className="error-filter-buttons">
            <button
              className={`error-filter-btn ${errorFilter === undefined ? 'active' : ''}`}
              onClick={() => handleErrorFilterChange(undefined)}
            >
              All
            </button>
            <button
              className={`error-filter-btn ${errorFilter === true ? 'active' : ''}`}
              onClick={() => handleErrorFilterChange(true)}
            >
              With Errors
            </button>
            <button
              className={`error-filter-btn ${errorFilter === false ? 'active' : ''}`}
              onClick={() => handleErrorFilterChange(false)}
            >
              No Errors
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

