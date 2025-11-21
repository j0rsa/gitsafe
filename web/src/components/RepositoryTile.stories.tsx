import type { Meta, StoryObj } from '@storybook/react'
import { RepositoryTile } from './RepositoryTile'
import type { Repository } from '../types'

const meta: Meta<typeof RepositoryTile> = {
  title: 'Components/RepositoryTile',
  component: RepositoryTile,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof RepositoryTile>

const sampleRepository: Repository = {
  id: 'repo-123',
  url: 'https://github.com/example/repository.git',
  credential_id: 'cred-456',
  enabled: true,
  last_sync: new Date().toISOString(),
  error: null,
}

export const Default: Story = {
  args: {
    repository: sampleRepository,
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const WithError: Story = {
  args: {
    repository: {
      ...sampleRepository,
      error: 'Failed to sync: Connection timeout',
    },
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const Inactive: Story = {
  args: {
    repository: {
      ...sampleRepository,
      enabled: false,
    },
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const NoCredential: Story = {
  args: {
    repository: {
      ...sampleRepository,
      credential_id: null,
    },
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const NeverSynced: Story = {
  args: {
    repository: {
      ...sampleRepository,
      last_sync: null,
    },
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const LongUrl: Story = {
  args: {
    repository: {
      ...sampleRepository,
      url: 'https://very-long-domain-name.example.com/very/long/path/to/repository.git',
    },
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

