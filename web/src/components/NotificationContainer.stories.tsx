import type { Meta, StoryObj } from '@storybook/react'
import { NotificationContainer } from './NotificationContainer'
import { useState } from 'react'
import type { Notification } from './Notification'

const meta: Meta<typeof NotificationContainer> = {
  title: 'Components/NotificationContainer',
  component: NotificationContainer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    notifications: {
      control: false,
      description: 'Array of notification objects to display',
    },
    onDismiss: {
      action: 'dismissed',
      description: 'Callback function called when a notification is dismissed',
    },
  },
}

export default meta
type Story = StoryObj<typeof NotificationContainer>

const createNotification = (
  message: string,
  type: Notification['type'],
  duration?: number
): Notification => ({
  id: `notification-${Date.now()}-${Math.random()}`,
  message,
  type,
  duration,
})

export const SingleNotification: Story = {
  render: (args) => {
    const [notifications, setNotifications] = useState<Notification[]>([
      createNotification('Repository synced successfully', 'info'),
    ])

    const handleDismiss = (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      args.onDismiss?.(id)
    }

    return (
      <div>
        <NotificationContainer notifications={notifications} onDismiss={handleDismiss} />
        <div style={{ padding: '2rem' }}>
          <h2>Single Notification</h2>
          <p>This shows a single notification in the container.</p>
        </div>
      </div>
    )
  },
}

export const MultipleNotifications: Story = {
  render: (args) => {
    const [notifications, setNotifications] = useState<Notification[]>([
      createNotification('Repository synced successfully', 'info'),
      createNotification('This action cannot be undone', 'warn'),
      createNotification('Failed to sync repository: Connection timeout', 'error'),
    ])

    const handleDismiss = (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      args.onDismiss?.(id)
    }

    return (
      <div>
        <NotificationContainer notifications={notifications} onDismiss={handleDismiss} />
        <div style={{ padding: '2rem' }}>
          <h2>Multiple Notifications</h2>
          <p>This shows multiple notifications stacked vertically.</p>
          <p style={{ marginTop: '1rem' }}>
            <strong>Active notifications:</strong> {notifications.length}
          </p>
        </div>
      </div>
    )
  },
}

export const ManyNotifications: Story = {
  render: (args) => {
    const [notifications, setNotifications] = useState<Notification[]>([
      createNotification('Info message 1', 'info'),
      createNotification('Warning message 1', 'warn'),
      createNotification('Error message 1', 'error'),
      createNotification('Info message 2', 'info'),
      createNotification('Warning message 2', 'warn'),
      createNotification('Error message 2', 'error'),
      createNotification('Info message 3', 'info'),
    ])

    const handleDismiss = (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      args.onDismiss?.(id)
    }

    return (
      <div>
        <NotificationContainer notifications={notifications} onDismiss={handleDismiss} />
        <div style={{ padding: '2rem' }}>
          <h2>Many Notifications</h2>
          <p>This demonstrates how the container handles many notifications.</p>
          <p style={{ marginTop: '1rem' }}>
            <strong>Active notifications:</strong> {notifications.length}
          </p>
        </div>
      </div>
    )
  },
}

export const EmptyState: Story = {
  render: (args) => {
    const [notifications] = useState<Notification[]>([])

    const handleDismiss = (id: string) => {
      args.onDismiss?.(id)
    }

    return (
      <div>
        <NotificationContainer notifications={notifications} onDismiss={handleDismiss} />
        <div style={{ padding: '2rem' }}>
          <h2>Empty State</h2>
          <p>When there are no notifications, the container renders nothing.</p>
        </div>
      </div>
    )
  },
}

export const InteractiveDemo: Story = {
  render: () => {
    const [notifications, setNotifications] = useState<Notification[]>([])

    const addNotification = (type: Notification['type']) => {
      const messages = {
        info: 'Repository synced successfully',
        warn: 'This action cannot be undone',
        error: 'Failed to sync repository: Connection timeout',
      }
      const newNotification = createNotification(messages[type], type, 5000)
      setNotifications((prev) => [...prev, newNotification])
    }

    const handleDismiss = (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }

    return (
      <div>
        <NotificationContainer notifications={notifications} onDismiss={handleDismiss} />
        <div style={{ padding: '2rem' }}>
          <h2>Interactive Notification Demo</h2>
          <p>Click the buttons below to add notifications. They will auto-dismiss after 5 seconds or you can click them to dismiss manually.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => addNotification('info')}
              style={{
                padding: '0.5rem 1rem',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Add Info Notification
            </button>
            <button
              onClick={() => addNotification('warn')}
              style={{
                padding: '0.5rem 1rem',
                background: '#f57c00',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Add Warning Notification
            </button>
            <button
              onClick={() => addNotification('error')}
              style={{
                padding: '0.5rem 1rem',
                background: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Add Error Notification
            </button>
            <button
              onClick={() => setNotifications([])}
              style={{
                padding: '0.5rem 1rem',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Clear All
            </button>
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f5f5f5', borderRadius: '6px' }}>
            <strong>Active notifications:</strong> {notifications.length}
          </div>
        </div>
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo that allows you to add and dismiss notifications. Use the buttons to add different types of notifications.',
      },
    },
  },
}

