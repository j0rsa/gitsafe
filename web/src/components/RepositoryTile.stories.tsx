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
  argTypes: {
    layout: {
      control: 'select',
      options: ['wide', 'square'],
      description: 'Layout style for the tile',
    },
    inProgress: {
      control: 'boolean',
      description: 'Whether the sync operation is in progress (rotates the sync icon)',
    },
  },
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
  size: 1024 * 1024 * 50, // 50 MB
}

export const Default: Story = {
  args: {
    repository: sampleRepository,
    layout: 'wide',
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const WideLayout: Story = {
  args: {
    repository: sampleRepository,
    layout: 'wide',
    inProgress: false,
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const WideLayoutInProgress: Story = {
  args: {
    repository: sampleRepository,
    layout: 'wide',
    inProgress: true,
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const SquareLayout: Story = {
  args: {
    repository: sampleRepository,
    layout: 'square',
    inProgress: false,
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const SquareLayoutInProgress: Story = {
  args: {
    repository: sampleRepository,
    layout: 'square',
    inProgress: true,
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
    layout: 'wide',
    inProgress: false,
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const WithErrorInProgress: Story = {
  args: {
    repository: {
      ...sampleRepository,
      error: 'Failed to sync: Connection timeout',
    },
    layout: 'wide',
    inProgress: true,
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const WithErrorSquare: Story = {
  args: {
    repository: {
      ...sampleRepository,
      error: 'Failed to sync: Connection timeout',
    },
    layout: 'square',
    inProgress: false,
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const WithErrorSquareInProgress: Story = {
  args: {
    repository: {
      ...sampleRepository,
      error: 'Failed to sync: Connection timeout',
    },
    layout: 'square',
    inProgress: true,
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
    layout: 'wide',
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const InactiveSquare: Story = {
  args: {
    repository: {
      ...sampleRepository,
      enabled: false,
    },
    layout: 'square',
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
    layout: 'wide',
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
    layout: 'wide',
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
    layout: 'wide',
    onSync: (id) => console.log('Sync:', id),
    onDelete: (id) => console.log('Delete:', id),
  },
}

export const LayoutComparison: Story = {
  render: () => {
    const repos: Repository[] = [
      sampleRepository,
      { ...sampleRepository, id: 'repo-456', url: 'https://github.com/another/repo.git' },
      { ...sampleRepository, id: 'repo-789', enabled: false },
      { ...sampleRepository, id: 'repo-101', url: 'https://gitlab.com/example/project.git', credential_id: 'cred-789' },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h3 style={{ marginBottom: '1rem' }}>Wide Layout (with icons before text)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
            {repos.map((repo, index) => (
              <RepositoryTile
                key={repo.id}
                repository={repo}
                layout="wide"
                inProgress={index === 0}
                onSync={(id) => console.log('Sync:', id)}
                onDelete={(id) => console.log('Delete:', id)}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: '1rem' }}>Square Layout (22% width, 4 per row, icon-only buttons)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 22%)', justifyContent: 'space-between', gap: '1.5rem' }}>
            {repos.map((repo, index) => (
              <RepositoryTile
                key={repo.id}
                repository={repo}
                layout="square"
                inProgress={index === 0}
                onSync={(id) => console.log('Sync:', id)}
                onDelete={(id) => console.log('Delete:', id)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  },
}

export const IconStates: Story = {
  render: () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h3 style={{ marginBottom: '1rem' }}>Wide Layout - Icon States</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
            <RepositoryTile
              repository={sampleRepository}
              layout="wide"
              inProgress={false}
              onSync={(id) => console.log('Sync:', id)}
              onDelete={(id) => console.log('Delete:', id)}
            />
            <RepositoryTile
              repository={sampleRepository}
              layout="wide"
              inProgress={true}
              onSync={(id) => console.log('Sync:', id)}
              onDelete={(id) => console.log('Delete:', id)}
            />
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: '1rem' }}>Square Layout - Icon States</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 22%)', justifyContent: 'space-between', gap: '1.5rem' }}>
            <RepositoryTile
              repository={sampleRepository}
              layout="square"
              inProgress={false}
              onSync={(id) => console.log('Sync:', id)}
              onDelete={(id) => console.log('Delete:', id)}
            />
            <RepositoryTile
              repository={sampleRepository}
              layout="square"
              inProgress={true}
              onSync={(id) => console.log('Sync:', id)}
              onDelete={(id) => console.log('Delete:', id)}
            />
          </div>
        </div>
      </div>
    )
  },
}

