import React, { useState } from 'react'
import type { SearchFilters } from '../types'
import { Autocomplete } from './Autocomplete'
import './FilterPanel.css'

export interface FilterPanelProps {
  onFilterChange: (filters: SearchFilters) => void
  nameSuggestions?: string[]
  urlSuggestions?: string[]
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  onFilterChange,
  nameSuggestions = [],
  urlSuggestions = [],
}) => {
  const [nameFilter, setNameFilter] = useState('')
  const [urlFilter, setUrlFilter] = useState('')
  const [errorFilter, setErrorFilter] = useState<boolean | undefined>(undefined)
  const [enabledFilter, setEnabledFilter] = useState<boolean | undefined>(undefined)


  const handleErrorFilterChange = (value: boolean | undefined) => {
    setErrorFilter(value)
    onFilterChange({
      name: nameFilter || undefined,
      url: urlFilter || undefined,
      has_error: value,
      enabled: enabledFilter,
    })
  }

  const handleEnabledFilterChange = (value: boolean | undefined) => {
    setEnabledFilter(value)
    onFilterChange({
      name: nameFilter || undefined,
      url: urlFilter || undefined,
      has_error: errorFilter,
      enabled: value,
    })
  }

  const clearFilters = () => {
    setNameFilter('')
    setUrlFilter('')
    setErrorFilter(undefined)
    setEnabledFilter(undefined)
    onFilterChange({})
  }

  const hasActiveFilters = nameFilter || urlFilter || errorFilter !== undefined || enabledFilter !== undefined

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
          <Autocomplete
            id="name-filter"
            label="Name/ID"
            placeholder="Filter by repository name or ID..."
            value={nameFilter}
            onChange={(value) => {
              setNameFilter(value)
              onFilterChange({
                name: value || undefined,
                url: urlFilter || undefined,
                has_error: errorFilter,
                enabled: enabledFilter,
              })
            }}
            suggestions={nameSuggestions}
            maxSuggestions={10}
          />
        </div>
        <div className="filter-group">
          <Autocomplete
            id="url-filter"
            label="URL"
            placeholder="Filter by URL (partial match)..."
            value={urlFilter}
            onChange={(value) => {
              setUrlFilter(value)
              onFilterChange({
                name: nameFilter || undefined,
                url: value || undefined,
                has_error: errorFilter,
                enabled: enabledFilter,
              })
            }}
            suggestions={urlSuggestions}
            maxSuggestions={10}
          />
        </div>
        <div className="filter-group">
          <label>Error State</label>
          <div className="filter-button-group">
            <button
              className={`filter-button-all ${errorFilter === undefined ? 'active' : ''}`}
              onClick={() => handleErrorFilterChange(undefined)}
            >
              All
            </button>
            <button
              className={`filter-button-error ${errorFilter === true ? 'active' : ''}`}
              onClick={() => handleErrorFilterChange(true)}
            >
              With Errors
            </button>
            <button
              className={`filter-button-success ${errorFilter === false ? 'active' : ''}`}
              onClick={() => handleErrorFilterChange(false)}
            >
              No Errors
            </button>
          </div>
        </div>
        <div className="filter-group">
          <label>Status</label>
          <div className="filter-button-group">
            <button
              className={`filter-button-all ${enabledFilter === undefined ? 'active' : ''}`}
              onClick={() => handleEnabledFilterChange(undefined)}
            >
              All
            </button>
            <button
              className={`filter-button-success ${enabledFilter === true ? 'active' : ''}`}
              onClick={() => handleEnabledFilterChange(true)}
            >
              Active
            </button>
            <button
              className={`filter-button-error ${enabledFilter === false ? 'active' : ''}`}
              onClick={() => handleEnabledFilterChange(false)}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

