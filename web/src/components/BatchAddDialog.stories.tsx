import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { BatchAddDialog } from './BatchAddDialog'
import type { Credential } from '../types'

const meta: Meta<typeof BatchAddDialog> = {
  title: 'Components/BatchAddDialog',
  component: BatchAddDialog,
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
type Story = StoryObj<typeof BatchAddDialog>

const sampleCredentials: Credential[] = [
  { id: 'cred-123', username: 'user1', is_ssh_key: false },
  { id: 'cred-456', username: 'user2', is_ssh_key: false },
  { id: 'cred-789', username: 'user3', is_ssh_key: true },
  { id: 'cred-abc', username: 'github-user', is_ssh_key: true },
  { id: 'cred-def', username: 'gitlab-user', is_ssh_key: false },
]

const DialogWrapper = ({ credentials, ...args }: { credentials: Credential[] } & Omit<Story['args'], 'credentials'>) => {
  const [isOpen, setIsOpen] = useState(true)

  const handleBatchAdd = async (
    repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
    onProgress?: (current: number, total: number) => void
  ) => {
    console.log('Batch adding repositories:', repositories)
    // Simulate API calls with progress
    for (let i = 0; i < repositories.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (onProgress) {
        onProgress(i + 1, repositories.length)
      }
    }
    setIsOpen(false)
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
        Open Batch Add Dialog
      </button>
      <BatchAddDialog
        credentials={credentials}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onBatchAdd={handleBatchAdd}
        {...args}
      />
    </>
  )
}

export const Default: Story = {
  render: () => (
    <DialogWrapper credentials={sampleCredentials} />
  ),
}

export const WithSampleUrls: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleBatchAdd = async (
      repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
      onProgress?: (current: number, total: number) => void
    ) => {
      console.log('Batch adding repositories:', repositories)
      for (let i = 0; i < repositories.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (onProgress) {
          onProgress(i + 1, repositories.length)
        }
      }
      setIsOpen(false)
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Batch Add Dialog (with sample URLs)
        </button>
        <BatchAddDialog
          credentials={sampleCredentials}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onBatchAdd={handleBatchAdd}
        />
      </>
    )
  },
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
    />
  ),
}

export const NoCredentials: Story = {
  render: () => (
    <DialogWrapper credentials={[]} />
  ),
}

export const ProcessingState: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleBatchAdd = async (
      repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
      onProgress?: (current: number, total: number) => void
    ) => {
      console.log('Batch adding repositories:', repositories)
      // Simulate slow API calls with progress updates
      for (let i = 0; i < repositories.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        if (onProgress) {
          onProgress(i + 1, repositories.length)
        }
      }
      setIsOpen(false)
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (with slow processing)
        </button>
        <BatchAddDialog
          credentials={sampleCredentials}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onBatchAdd={handleBatchAdd}
        />
      </>
    )
  },
}

export const ValidationError: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleBatchAdd = async (
      repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
      _onProgress?: (current: number, total: number) => void
    ) => {
      console.log('Batch adding repositories:', repositories)
      // Simulate validation error
      throw new Error('Invalid URLs:\nLine 2: Invalid URL format. Use HTTP/HTTPS or SSH format (git@host:path)\nLine 5: Invalid HTTP/HTTPS URL format')
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (with validation error)
        </button>
        <BatchAddDialog
          credentials={sampleCredentials}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onBatchAdd={handleBatchAdd}
        />
      </>
    )
  },
}

export const ServerError: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleBatchAdd = async (
      repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
      onProgress?: (current: number, total: number) => void
    ) => {
      console.log('Batch adding repositories:', repositories)
      // Simulate server error after some progress
      if (onProgress) {
        onProgress(2, repositories.length)
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      throw new Error('Internal server error. Please try again later.')
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (server error)
        </button>
        <BatchAddDialog
          credentials={sampleCredentials}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onBatchAdd={handleBatchAdd}
        />
      </>
    )
  },
}

export const PartialFailure: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleBatchAdd = async (
      repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
      onProgress?: (current: number, total: number) => void
    ) => {
      console.log('Batch adding repositories:', repositories)
      // Simulate partial failure
      for (let i = 0; i < repositories.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (onProgress) {
          onProgress(i + 1, repositories.length)
        }
        // Fail on 3rd repository
        if (i === 2) {
          throw new Error(`Failed to add ${repositories.length} repositories:\n${repositories[2].url}: Repository already exists\n${repositories[3].url}: Authentication failed`)
        }
      }
      setIsOpen(false)
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (partial failure)
        </button>
        <BatchAddDialog
          credentials={sampleCredentials}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onBatchAdd={handleBatchAdd}
        />
      </>
    )
  },
}

export const LargeBatch: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleBatchAdd = async (
      repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
      onProgress?: (current: number, total: number) => void
    ) => {
      console.log('Batch adding repositories:', repositories)
      for (let i = 0; i < repositories.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        if (onProgress) {
          onProgress(i + 1, repositories.length)
        }
      }
      setIsOpen(false)
    }

    return (
      <>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
          <p><strong>Large Batch Demo:</strong></p>
          <p>This demonstrates handling a large batch of 20 repositories with progress tracking.</p>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (large batch)
        </button>
        <BatchAddDialog
          credentials={sampleCredentials}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onBatchAdd={handleBatchAdd}
        />
      </>
    )
  },
}

export const MixedUrlTypes: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleBatchAdd = async (
      repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
      onProgress?: (current: number, total: number) => void
    ) => {
      console.log('Batch adding repositories:', repositories)
      for (let i = 0; i < repositories.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (onProgress) {
          onProgress(i + 1, repositories.length)
        }
      }
      setIsOpen(false)
    }

    return (
      <>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
          <p><strong>Mixed URL Types Demo:</strong></p>
          <p>This demonstrates handling both HTTP/HTTPS and SSH URLs in the same batch.</p>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (mixed URLs)
        </button>
        <BatchAddDialog
          credentials={sampleCredentials}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onBatchAdd={handleBatchAdd}
        />
      </>
    )
  },
}

export const CredentialMismatchError: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleBatchAdd = async (
      repositories: Array<{ url: string; credential_id: string | null; id: string | null }>,
      _onProgress?: (current: number, total: number) => void
    ) => {
      console.log('Batch adding repositories:', repositories)
      // This will trigger client-side validation
      throw new Error('HTTP/HTTPS URLs require credentials with username/password. Please select a credential without SSH key or use SSH URLs only.')
    }

    return (
      <>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
          <p><strong>Credential Mismatch Demo:</strong></p>
          <p>This demonstrates validation when HTTP URLs are used with SSH-only credentials.</p>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (credential mismatch)
        </button>
        <BatchAddDialog
          credentials={sampleCredentials}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onBatchAdd={handleBatchAdd}
        />
      </>
    )
  },
}

