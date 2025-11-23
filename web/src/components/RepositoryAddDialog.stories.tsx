import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { RepositoryAddDialog } from './RepositoryAddDialog'
import type { Credential } from '../types'

const meta: Meta<typeof RepositoryAddDialog> = {
  title: 'Components/RepositoryAddDialog',
  component: RepositoryAddDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the dialog is open',
    },
  },
}

export default meta
type Story = StoryObj<typeof RepositoryAddDialog>

const sampleCredentials: Credential[] = [
  { id: 'cred-123', username: 'user1', is_ssh_key: false },
  { id: 'cred-456', username: 'user2', is_ssh_key: false },
  { id: 'cred-789', username: 'user3', is_ssh_key: true },
  { id: 'cred-abc', username: 'github-user', is_ssh_key: true },
  { id: 'cred-def', username: 'gitlab-user', is_ssh_key: false },
]

const sampleUrlSuggestions = [
  'https://github.com',
  'https://gitlab.com',
  'https://bitbucket.org',
  'https://github.com/example',
  'https://github.com/another-org',
  'https://gitlab.com/user',
  'https://bitbucket.org/workspace',
]

const DialogWrapper = ({ credentials, urlSuggestions, ...args }: { credentials: Credential[]; urlSuggestions?: string[] } & Omit<Story['args'], 'credentials' | 'urlSuggestions'>) => {
  const [isOpen, setIsOpen] = useState(true)

  const handleSave = async (data: { url: string; credential_id: string | null }) => {
    console.log('Adding repository:', data)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsOpen(false)
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
        Open Add Dialog
      </button>
      <RepositoryAddDialog
        credentials={credentials}
        urlSuggestions={urlSuggestions || []}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
        {...args}
      />
    </>
  )
}

export const Default: Story = {
  render: () => (
    <DialogWrapper
      credentials={sampleCredentials}
      urlSuggestions={sampleUrlSuggestions}
    />
  ),
}

export const NoUrlSuggestions: Story = {
  render: () => (
    <DialogWrapper
      credentials={sampleCredentials}
      urlSuggestions={[]}
    />
  ),
}

export const ManyCredentials: Story = {
  render: () => (
    <DialogWrapper
      credentials={[
        ...sampleCredentials,
        { id: 'cred-001', username: 'credential-001', is_ssh_key: false },
        { id: 'cred-002', username: 'credential-002', is_ssh_key: false },
        { id: 'cred-003', username: 'credential-003', is_ssh_key: true },
        { id: 'cred-004', username: 'credential-004', is_ssh_key: false },
        { id: 'cred-005', username: 'credential-005', is_ssh_key: true },
        { id: 'cred-006', username: 'credential-006', is_ssh_key: false },
        { id: 'cred-007', username: 'credential-007', is_ssh_key: false },
        { id: 'cred-008', username: 'credential-008', is_ssh_key: true },
        { id: 'cred-009', username: 'credential-009', is_ssh_key: false },
        { id: 'cred-010', username: 'credential-010', is_ssh_key: false },
      ]}
      urlSuggestions={sampleUrlSuggestions}
    />
  ),
}

export const NoCredentials: Story = {
  render: () => (
    <DialogWrapper
      credentials={[]}
      urlSuggestions={sampleUrlSuggestions}
    />
  ),
}

export const SavingState: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleSave = async (data: { url: string; credential_id: string | null }) => {
      console.log('Adding repository:', data)
      // Simulate long API call
      await new Promise((resolve) => setTimeout(resolve, 3000))
      setIsOpen(false)
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (with slow save)
        </button>
        <RepositoryAddDialog
          credentials={sampleCredentials}
          urlSuggestions={sampleUrlSuggestions}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
        />
      </>
    )
  },
}

export const ValidationError: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleSave = async (data: { url: string; credential_id: string | null }) => {
      console.log('Adding repository:', data)
      // Simulate validation error
      throw new Error('Repository URL already exists')
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (with error)
        </button>
        <RepositoryAddDialog
          credentials={sampleCredentials}
          urlSuggestions={sampleUrlSuggestions}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
        />
      </>
    )
  },
}

export const InvalidUrlError: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleSave = async (data: { url: string; credential_id: string | null }) => {
      console.log('Adding repository:', data)
      // This will trigger client-side validation
      if (!data.url.startsWith('http')) {
        throw new Error('Please enter a valid URL (e.g., https://github.com/user/repo.git)')
      }
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (invalid URL)
        </button>
        <RepositoryAddDialog
          credentials={sampleCredentials}
          urlSuggestions={sampleUrlSuggestions}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
        />
      </>
    )
  },
}

export const ServerError: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleSave = async (data: { url: string; credential_id: string | null }) => {
      console.log('Adding repository:', data)
      // Simulate server error
      throw new Error('Internal server error. Please try again later.')
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (server error)
        </button>
        <RepositoryAddDialog
          credentials={sampleCredentials}
          urlSuggestions={sampleUrlSuggestions}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
        />
      </>
    )
  },
}

export const NetworkError: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleSave = async (data: { url: string; credential_id: string | null }) => {
      console.log('Adding repository:', data)
      // Simulate network error
      throw new Error('Network error: Failed to connect to server. Please check your internet connection.')
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (network error)
        </button>
        <RepositoryAddDialog
          credentials={sampleCredentials}
          urlSuggestions={sampleUrlSuggestions}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
        />
      </>
    )
  },
}

export const DuplicateRepositoryError: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleSave = async (data: { url: string; credential_id: string | null }) => {
      console.log('Adding repository:', data)
      // Simulate duplicate repository error
      throw new Error('Repository with this URL already exists')
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (duplicate error)
        </button>
        <RepositoryAddDialog
          credentials={sampleCredentials}
          urlSuggestions={sampleUrlSuggestions}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
        />
      </>
    )
  },
}

export const LongErrorMessage: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleSave = async (data: { url: string; credential_id: string | null }) => {
      console.log('Adding repository:', data)
      // Simulate long error message
      throw new Error('Failed to add repository: The repository URL provided is invalid or the repository does not exist. Please verify that the URL is correct and that you have access to the repository. Additionally, ensure that the credential ID provided (if any) has the necessary permissions to access this repository.')
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (long error message)
        </button>
        <RepositoryAddDialog
          credentials={sampleCredentials}
          urlSuggestions={sampleUrlSuggestions}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
        />
      </>
    )
  },
}

export const ErrorRecovery: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)
    const [attemptCount, setAttemptCount] = useState(0)

    const handleSave = async (data: { url: string; credential_id: string | null }) => {
      console.log('Adding repository:', data)
      setAttemptCount(prev => prev + 1)
      
      // Fail first two attempts, succeed on third
      if (attemptCount < 2) {
        throw new Error(`Attempt ${attemptCount + 1} failed. Please try again.`)
      }
      
      // Simulate success on third attempt
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return (
      <>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
          <p><strong>Error Recovery Demo:</strong></p>
          <p>This demonstrates error handling and recovery. The first two attempts will fail, the third will succeed.</p>
          <p>Attempts: {attemptCount}</p>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (error recovery)
        </button>
        <RepositoryAddDialog
          credentials={sampleCredentials}
          urlSuggestions={sampleUrlSuggestions}
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false)
            setAttemptCount(0)
          }}
          onSave={handleSave}
        />
      </>
    )
  },
}

