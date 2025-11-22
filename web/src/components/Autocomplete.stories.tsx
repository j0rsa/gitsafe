import type { Meta, StoryObj } from '@storybook/react'
import { Autocomplete } from './Autocomplete'
import { useState } from 'react'

const meta: Meta<typeof Autocomplete> = {
  title: 'Components/Autocomplete',
  component: Autocomplete,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    maxSuggestions: {
      control: { type: 'number', min: 1, max: 20 },
      description: 'Maximum number of suggestions to display',
    },
  },
}

export default meta
type Story = StoryObj<typeof Autocomplete>

const sampleNames = [
  'repo-123',
  'repo-456',
  'repo-789',
  'repository-alpha',
  'repository-beta',
  'my-repo',
  'test-repository',
  'production-repo',
  'staging-repo',
  'dev-repo',
  'backend-repo',
  'frontend-repo',
]

const sampleUrls = [
  'https://github.com/example/repository.git',
  'https://github.com/another/project.git',
  'https://gitlab.com/example/project.git',
  'https://gitlab.com/another/repo.git',
  'https://bitbucket.org/sample/repo.git',
  'https://github.com/user/frontend.git',
  'https://github.com/user/backend.git',
  'https://gitlab.com/team/api.git',
  'https://github.com/org/microservice.git',
  'https://bitbucket.org/company/mobile.git',
]

const AutocompleteWrapper = (args: any) => {
  const [value, setValue] = useState('')
  return <Autocomplete {...args} value={value} onChange={setValue} />
}

export const Default: Story = {
  render: (args) => <AutocompleteWrapper {...args} />,
  args: {
    id: 'autocomplete-default',
    label: 'Repository Name/ID',
    placeholder: 'Start typing to see suggestions...',
    suggestions: sampleNames,
    maxSuggestions: 10,
  },
}

export const WithUrls: Story = {
  render: (args) => <AutocompleteWrapper {...args} />,
  args: {
    id: 'autocomplete-urls',
    label: 'Repository URL',
    placeholder: 'Filter by URL...',
    suggestions: sampleUrls,
    maxSuggestions: 10,
  },
}

export const ManySuggestions: Story = {
  render: (args) => <AutocompleteWrapper {...args} />,
  args: {
    id: 'autocomplete-many',
    label: 'Repository Name',
    placeholder: 'Type to filter many suggestions...',
    suggestions: [
      ...sampleNames,
      'repo-extra-1',
      'repo-extra-2',
      'repo-extra-3',
      'repo-extra-4',
      'repo-extra-5',
      'repo-extra-6',
      'repo-extra-7',
      'repo-extra-8',
      'repo-extra-9',
      'repo-extra-10',
    ],
    maxSuggestions: 5,
  },
}

export const FewSuggestions: Story = {
  render: (args) => <AutocompleteWrapper {...args} />,
  args: {
    id: 'autocomplete-few',
    label: 'Repository Name',
    placeholder: 'Limited suggestions...',
    suggestions: ['repo-1', 'repo-2', 'repo-3'],
    maxSuggestions: 10,
  },
}

export const NoSuggestions: Story = {
  render: (args) => <AutocompleteWrapper {...args} />,
  args: {
    id: 'autocomplete-empty',
    label: 'Repository Name',
    placeholder: 'No suggestions available...',
    suggestions: [],
    maxSuggestions: 10,
  },
}

export const FilteringDemo: Story = {
  render: () => {
    const [nameValue, setNameValue] = useState('')
    const [urlValue, setUrlValue] = useState('')

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h3 style={{ marginBottom: '1rem' }}>Name/ID Autocomplete</h3>
          <Autocomplete
            id="demo-name"
            label="Repository Name/ID"
            placeholder="Try typing 'repo' or 'repository'..."
            value={nameValue}
            onChange={setNameValue}
            suggestions={sampleNames}
            maxSuggestions={10}
          />
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f5f5f5', borderRadius: '6px' }}>
            <strong>Current value:</strong> {nameValue || '(empty)'}
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: '1rem' }}>URL Autocomplete</h3>
          <Autocomplete
            id="demo-url"
            label="Repository URL"
            placeholder="Try typing 'github' or 'gitlab'..."
            value={urlValue}
            onChange={setUrlValue}
            suggestions={sampleUrls}
            maxSuggestions={10}
          />
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f5f5f5', borderRadius: '6px' }}>
            <strong>Current value:</strong> {urlValue || '(empty)'}
          </div>
        </div>
      </div>
    )
  },
}

export const KeyboardNavigation: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return (
      <div>
        <Autocomplete
          id="keyboard-demo"
          label="Try keyboard navigation"
          placeholder="Use Arrow keys, Enter, and Escape..."
          value={value}
          onChange={setValue}
          suggestions={sampleNames}
          maxSuggestions={10}
        />
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '6px', fontSize: '0.875rem' }}>
          <strong>Keyboard shortcuts:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
            <li><kbd>↑</kbd> / <kbd>↓</kbd> - Navigate suggestions</li>
            <li><kbd>Enter</kbd> - Select highlighted suggestion</li>
            <li><kbd>Escape</kbd> - Close dropdown</li>
            <li><kbd>Click outside</kbd> - Close dropdown</li>
          </ul>
        </div>
      </div>
    )
  },
}

