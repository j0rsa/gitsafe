import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './Autocomplete.css'

export interface AutocompleteProps {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  maxSuggestions?: number
  moveCursorToEnd?: boolean // Whether to move cursor to end after selection
  openOnEmptyFocus?: boolean // Whether to open dropdown when focusing empty input
}

export const Autocomplete: React.FC<AutocompleteProps> = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  suggestions,
  maxSuggestions = 10,
  moveCursorToEnd = true, // Default to true for backward compatibility
  openOnEmptyFocus = false, // Default to false - require typing to open
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Initialize portal container to document.body
  useEffect(() => {
    setPortalContainer(document.body)
  }, [])

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
  // If value is empty, show all suggestions (up to maxSuggestions)
  const filteredSuggestions = value.length > 0
    ? suggestions
        .filter((suggestion) => fuzzyMatch(suggestion, value))
        .slice(0, maxSuggestions)
    : suggestions.slice(0, maxSuggestions)

  const showDropdown = isOpen && filteredSuggestions.length > 0

  // Recalculate position right before showing dropdown
  useEffect(() => {
    if (showDropdown) {
      // Calculate immediately and then multiple times to account for dialog animations
      updateDropdownPosition()
      const timer1 = setTimeout(() => updateDropdownPosition(), 10)
      const timer2 = setTimeout(() => updateDropdownPosition(), 50)
      const timer3 = setTimeout(() => updateDropdownPosition(), 100)
      
      const frameId = requestAnimationFrame(() => {
        updateDropdownPosition()
        requestAnimationFrame(() => updateDropdownPosition())
      })
      
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
        cancelAnimationFrame(frameId)
      }
    }
  }, [showDropdown])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    updateDropdownPosition()
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  // Update dropdown position based on input position
  const updateDropdownPosition = () => {
    if (inputRef.current) {
      // Force a reflow to ensure the element is fully rendered
      void inputRef.current.offsetHeight
      
      const rect = inputRef.current.getBoundingClientRect()
      // getBoundingClientRect() gives viewport coordinates, which is correct for position: fixed
      // Add a small margin for spacing
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }

  // Handle input focus
  const handleInputFocus = () => {
    // Open dropdown on focus if:
    // 1. openOnEmptyFocus is true (even if input is empty), OR
    // 2. input has value and there are filtered suggestions
    if (openOnEmptyFocus && filteredSuggestions.length > 0) {
      setIsOpen(true)
    } else if (value.length > 0 && filteredSuggestions.length > 0) {
      setIsOpen(true)
    }
  }

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    setIsOpen(false)
    // Move cursor to end of input after selection only if moveCursorToEnd is true
    if (moveCursorToEnd) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          const length = suggestion.length
          inputRef.current.setSelectionRange(length, length)
        }
      }, 0)
    } else {
      // Just blur the input if we don't want cursor to jump
      setTimeout(() => {
        inputRef.current?.blur()
      }, 0)
    }
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
          const selectedSuggestion = filteredSuggestions[highlightedIndex]
          onChange(selectedSuggestion)
          setIsOpen(false)
          // Move cursor to end of input after selection only if moveCursorToEnd is true
          if (moveCursorToEnd) {
            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.focus()
                const length = selectedSuggestion.length
                inputRef.current.setSelectionRange(length, length)
              }
            }, 0)
          } else {
            // Just blur the input if we don't want cursor to jump
            setTimeout(() => {
              inputRef.current?.blur()
            }, 0)
          }
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }


  // Update position when window scrolls or resizes
  useEffect(() => {
    if (isOpen) {
      const handleScroll = () => {
        updateDropdownPosition()
      }
      const handleResize = () => {
        updateDropdownPosition()
      }

      // Listen to scroll events on window and all scrollable parents
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)
      
      // Also listen to scroll on document
      document.addEventListener('scroll', handleScroll, true)
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
        document.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [isOpen])

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
      <div className="autocomplete-container">
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
        {showDropdown && portalContainer && createPortal(
          <div
            ref={dropdownRef}
            className="autocomplete-dropdown"
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
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
          </div>,
          portalContainer
        )}
      </div>
    </div>
  )
}

