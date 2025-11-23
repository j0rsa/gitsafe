import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { RepositoryEditDialog } from './RepositoryEditDialog'
import type { Repository, Credential } from '../types'

const meta: Meta<typeof RepositoryEditDialog> = {
  title: 'Components/RepositoryEditDialog',
  component: RepositoryEditDialog,
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
type Story = StoryObj<typeof RepositoryEditDialog>

const sampleRepository: Repository = {
  id: 'repo-123',
  url: 'https://github.com/example/repository.git',
  credential_id: 'cred-456',
  enabled: true,
  last_sync: new Date().toISOString(),
  error: null,
  size: 1024 * 1024 * 50, // 50 MB
}

const sampleCredentials: Credential[] = [
  { id: 'cred-123', username: 'user1' },
  { id: 'cred-456', username: 'user2' },
  { id: 'cred-789', username: 'user3' },
  { id: 'cred-abc', username: 'github-user' },
  { id: 'cred-def', username: 'gitlab-user' },
]

const DialogWrapper = ({ repository, credentials, ...args }: { repository: Repository; credentials: Credential[] } & Omit<Story['args'], 'repository' | 'credentials'>) => {
  const [isOpen, setIsOpen] = useState(true)
  const [currentRepo, setCurrentRepo] = useState(repository)

  const handleSave = async (updates: { enabled: boolean; credential_id: string | null }) => {
    console.log('Saving:', updates)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setCurrentRepo({ ...currentRepo, ...updates })
    setIsOpen(false)
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
        Open Dialog
      </button>
      <RepositoryEditDialog
        repository={currentRepo}
        credentials={credentials}
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
      repository={sampleRepository}
      credentials={sampleCredentials}
    />
  ),
}

export const WithError: Story = {
  render: () => (
    <DialogWrapper
      repository={{
        ...sampleRepository,
        error: 'Failed to sync: Connection timeout after 30 seconds. Please check your network connection and try again.',
      }}
      credentials={sampleCredentials}
    />
  ),
}

export const InactiveRepository: Story = {
  render: () => (
    <DialogWrapper
      repository={{
        ...sampleRepository,
        enabled: false,
      }}
      credentials={sampleCredentials}
    />
  ),
}

export const InactiveWithError: Story = {
  render: () => (
    <DialogWrapper
      repository={{
        ...sampleRepository,
        enabled: false,
        error: 'Authentication failed: Invalid credentials. Please update your credential ID.',
      }}
      credentials={sampleCredentials}
    />
  ),
}

export const NoCredential: Story = {
  render: () => (
    <DialogWrapper
      repository={{
        ...sampleRepository,
        credential_id: null,
      }}
      credentials={sampleCredentials}
    />
  ),
}

export const LongErrorMessage: Story = {
  render: () => (
    <DialogWrapper
      repository={{
        ...sampleRepository,
        error: 'Failed to sync repository: Multiple errors occurred during the synchronization process. First, there was a connection timeout when trying to reach the remote server. Second, the authentication credentials provided were invalid or expired. Third, there was a conflict with the local repository state that prevented the merge operation from completing successfully. Please verify your network connection, update your credentials, and resolve any local conflicts before attempting to sync again.',
      }}
      credentials={sampleCredentials}
    />
  ),
}

export const ManyCredentials: Story = {
  render: () => (
    <DialogWrapper
      repository={sampleRepository}
      credentials={[
        ...sampleCredentials,
        { id: 'cred-001', username: 'credential-001' },
        { id: 'cred-002', username: 'credential-002' },
        { id: 'cred-003', username: 'credential-003' },
        { id: 'cred-004', username: 'credential-004' },
        { id: 'cred-005', username: 'credential-005' },
        { id: 'cred-006', username: 'credential-006' },
        { id: 'cred-007', username: 'credential-007' },
        { id: 'cred-008', username: 'credential-008' },
        { id: 'cred-009', username: 'credential-009' },
        { id: 'cred-010', username: 'credential-010' },
      ]}
    />
  ),
}

export const SavingState: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    const handleSave = async (updates: { enabled: boolean; credential_id: string | null }) => {
      console.log('Saving:', updates)
      // Simulate long API call
      await new Promise((resolve) => setTimeout(resolve, 3000))
      setIsOpen(false)
    }

    return (
      <>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem' }}>
          Open Dialog (with slow save)
        </button>
        <RepositoryEditDialog
          repository={sampleRepository}
          credentials={sampleCredentials}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
        />
      </>
    )
  },
}

