import type { Meta, StoryObj } from '@storybook/react'
import { Dashboard } from './Dashboard'
import type { Repository, Credential } from '../types'
import { apiClient } from '../api/client'

const meta: Meta<typeof Dashboard> = {
  title: 'Pages/Dashboard',
  component: Dashboard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Dashboard>

// Sample data for mocking
const sampleRepositories: Repository[] = [
  {
    id: 'repo-1',
    url: 'https://github.com/example/repository.git',
    credential_id: 'cred-1',
    enabled: true,
    last_sync: new Date(Date.now() - 3600000).toISOString(),
    error: null,
    size: 1024 * 1024 * 50, // 50 MB
  },
  {
    id: 'repo-2',
    url: 'https://gitlab.com/another/project.git',
    credential_id: 'cred-2',
    enabled: true,
    last_sync: new Date(Date.now() - 7200000).toISOString(),
    error: null,
    size: 1024 * 1024 * 100, // 100 MB
  },
  {
    id: 'repo-3',
    url: 'https://github.com/disabled/repo.git',
    credential_id: 'cred-1',
    enabled: false,
    last_sync: new Date(Date.now() - 86400000).toISOString(),
    error: null,
    size: null,
  },
  {
    id: 'repo-4',
    url: 'https://github.com/error/repo.git',
    credential_id: 'cred-3',
    enabled: true,
    last_sync: new Date(Date.now() - 10800000).toISOString(),
    error: 'Failed to sync: Connection timeout',
    size: null,
  },
  {
    id: 'repo-5',
    url: 'https://bitbucket.org/sample/repo.git',
    credential_id: null,
    enabled: true,
    last_sync: null,
    error: null,
    size: null,
  },
]

const sampleCredentials: Credential[] = [
  { id: 'cred-1', username: 'user1' },
  { id: 'cred-2', username: 'user2' },
  { id: 'cred-3', username: 'user3' },
]

// Note: API client methods are mocked in decorators below

export const Default: Story = {
  decorators: [
    (Story) => {
      // Mock API methods before rendering
      apiClient.getRepositories = async () => sampleRepositories
      apiClient.getCredentials = async () => sampleCredentials
      apiClient.syncRepository = async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        return { message: 'Synced', archive: 'archive.zip' }
      }
      apiClient.deleteRepository = async () => {}
      
      return <Story />
    },
  ],
}

export const WithData: Story = {
  decorators: [
    (Story) => {
      apiClient.getRepositories = async () => sampleRepositories
      apiClient.getCredentials = async () => sampleCredentials
      apiClient.syncRepository = async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        return { message: 'Synced', archive: 'archive.zip' }
      }
      apiClient.deleteRepository = async () => {}
      
      return <Story />
    },
  ],
}

export const EmptyState: Story = {
  decorators: [
    (Story) => {
      apiClient.getRepositories = async () => []
      apiClient.getCredentials = async () => []
      apiClient.syncRepository = async () => ({ message: 'Synced', archive: 'archive.zip' })
      apiClient.deleteRepository = async () => {}
      
      return <Story />
    },
  ],
}

export const LoadingState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Shows the loading state when repositories are being fetched from the backend. The spinner and loading message are displayed while data is loading.',
      },
    },
  },
  decorators: [
    (Story) => {
      // Use a long delay to keep the loading state visible
      apiClient.getRepositories = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100000))
        return sampleRepositories
      }
      apiClient.getCredentials = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100000))
        return sampleCredentials
      }
      
      return <Story />
    },
  ],
}

export const LoadingStateQuick: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Shows the loading state with a shorter delay (2 seconds) to demonstrate the loading animation.',
      },
    },
  },
  decorators: [
    (Story) => {
      apiClient.getRepositories = async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        return sampleRepositories
      }
      apiClient.getCredentials = async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        return sampleCredentials
      }
      
      return <Story />
    },
  ],
}

export const ErrorState: Story = {
  decorators: [
    (Story) => {
      apiClient.getRepositories = async () => {
        throw new Error('Failed to load repositories')
      }
      apiClient.getCredentials = async () => {
        throw new Error('Failed to load credentials')
      }
      
      return <Story />
    },
  ],
}

