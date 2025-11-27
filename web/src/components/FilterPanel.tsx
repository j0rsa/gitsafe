import React, { useState } from 'react'
import type { SearchFilters } from '../types'
import { Autocomplete } from './Autocomplete'
import './FilterPanel.css'

export interface FilterPanelProps {
  onFilterChange: (filters: SearchFilters) => void
  nameSuggestions?: string[]
  hostSuggestions?: string[]
  orgSuggestions?: string[]
  inactiveCount?: number
  erroredCount?: number
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  onFilterChange,
  nameSuggestions = [],
  hostSuggestions = [],
  orgSuggestions = [],
  inactiveCount = 0,
  erroredCount = 0,
}) => {
  const [nameFilter, setNameFilter] = useState('')
  const [hostFilter, setHostFilter] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [errorFilter, setErrorFilter] = useState<boolean | undefined>(undefined)
  const [enabledFilter, setEnabledFilter] = useState<boolean | undefined>(undefined)


  const handleErrorFilterChange = (value: boolean | undefined) => {
    setErrorFilter(value)
    onFilterChange({
      name: nameFilter || undefined,
      host: hostFilter || undefined,
      org: orgFilter || undefined,
      has_error: value,
      enabled: enabledFilter,
    })
  }

  const handleEnabledFilterChange = (value: boolean | undefined) => {
    setEnabledFilter(value)
    onFilterChange({
      name: nameFilter || undefined,
      host: hostFilter || undefined,
      org: orgFilter || undefined,
      has_error: errorFilter,
      enabled: value,
    })
  }

  const clearFilters = () => {
    setNameFilter('')
    setHostFilter('')
    setOrgFilter('')
    setErrorFilter(undefined)
    setEnabledFilter(undefined)
    onFilterChange({})
  }

  const hasActiveFilters = nameFilter || hostFilter || orgFilter || errorFilter !== undefined || enabledFilter !== undefined

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
                host: hostFilter || undefined,
                org: orgFilter || undefined,
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
            id="host-filter"
            label="Host"
            placeholder="Filter by hostname (e.g., github.com)..."
            value={hostFilter}
            onChange={(value) => {
              setHostFilter(value)
              onFilterChange({
                name: nameFilter || undefined,
                host: value || undefined,
                org: orgFilter || undefined,
                has_error: errorFilter,
                enabled: enabledFilter,
              })
            }}
            suggestions={hostSuggestions}
            maxSuggestions={10}
            openOnEmptyFocus={true}
          />
        </div>
        <div className="filter-group">
          <Autocomplete
            id="org-filter"
            label="Organization/User"
            placeholder="Filter by organization or user..."
            value={orgFilter}
            onChange={(value) => {
              setOrgFilter(value)
              onFilterChange({
                name: nameFilter || undefined,
                host: hostFilter || undefined,
                org: value || undefined,
                has_error: errorFilter,
                enabled: enabledFilter,
              })
            }}
            suggestions={orgSuggestions}
            maxSuggestions={10}
            openOnEmptyFocus={true}
          />
        </div>
        {erroredCount > 0 && (
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
                <span>With Errors</span>
                <span className="filter-count">({erroredCount})</span>
              </button>
              <button
                className={`filter-button-success ${errorFilter === false ? 'active' : ''}`}
                onClick={() => handleErrorFilterChange(false)}
              >
                No Errors
              </button>
            </div>
          </div>
        )}
        {inactiveCount > 0 && (
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
                <span>Inactive</span>
                <span className="filter-count">({inactiveCount})</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

