import React, { useState, useRef, useEffect } from 'react'
import './Autocomplete.css'

export interface AutocompleteProps {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  maxSuggestions?: number
}

export const Autocomplete: React.FC<AutocompleteProps> = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  suggestions,
  maxSuggestions = 10,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Filter suggestions based on input value with fuzzy matching
  const filteredSuggestions = suggestions
    .filter((suggestion) => fuzzyMatch(suggestion, value))
    .slice(0, maxSuggestions)

  const showDropdown = isOpen && value.length > 0 && filteredSuggestions.length > 0

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  // Handle input focus
  const handleInputFocus = () => {
    if (value.length > 0 && filteredSuggestions.length > 0) {
      setIsOpen(true)
    }
  }

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    setIsOpen(false)
    inputRef.current?.blur()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
          handleSuggestionClick(filteredSuggestions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="autocomplete-wrapper">
      <label htmlFor={id}>{label}</label>
      <div className="autocomplete-container" ref={dropdownRef}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          className="autocomplete-input"
          autoComplete="off"
        />
        {showDropdown && (
          <div className="autocomplete-dropdown">
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={`autocomplete-suggestion ${
                  index === highlightedIndex ? 'highlighted' : ''
                }`}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

