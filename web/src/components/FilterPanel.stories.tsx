import type { Meta, StoryObj } from '@storybook/react'
import { FilterPanel } from './FilterPanel'
import { useState } from 'react'
import type { SearchFilters } from '../types'

const meta: Meta<typeof FilterPanel> = {
  title: 'Components/FilterPanel',
  component: FilterPanel,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof FilterPanel>

const FilterPanelWrapper = () => {
  const [filters, setFilters] = useState({})
  
  return (
    <div>
      <FilterPanel onFilterChange={setFilters} />
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <strong>Current Filters:</strong>
        <pre style={{ marginTop: '0.5rem' }}>{JSON.stringify(filters, null, 2)}</pre>
      </div>
    </div>
  )
}

export const Default: Story = {
  render: () => <FilterPanelWrapper />,
}

export const WithActiveFilters: Story = {
  render: () => {
    const [filters, setFilters] = useState<SearchFilters>({ name: 'test', has_error: true })
    
    return (
      <div>
        <FilterPanel onFilterChange={setFilters} />
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
          <strong>Current Filters:</strong>
          <pre style={{ marginTop: '0.5rem' }}>{JSON.stringify(filters, null, 2)}</pre>
        </div>
      </div>
    )
  },
}

