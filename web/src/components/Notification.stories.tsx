import type { Meta, StoryObj } from '@storybook/react'
import { NotificationItem, type Notification } from './Notification'
import { useState } from 'react'

const meta: Meta<typeof NotificationItem> = {
  title: 'Components/Notification',
  component: NotificationItem,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    notification: {
      control: false,
      description: 'The notification object containing id, message, type, and optional duration',
    },
    onDismiss: {
      action: 'dismissed',
      description: 'Callback function called when notification is dismissed',
    },
  },
}

export default meta
type Story = StoryObj<typeof NotificationItem>

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

export const Info: Story = {
  render: (args) => {
    const [dismissed, setDismissed] = useState(false)
    const notification = createNotification(
      'Repository synced successfully',
      'info',
      5000
    )
    
    return (
      <div>
        <NotificationItem
          {...args}
          notification={notification}
          onDismiss={(id) => {
            setDismissed(true)
            args.onDismiss?.(id)
          }}
        />
        {dismissed && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f5f5f5', borderRadius: '6px' }}>
            Notification dismissed
          </div>
        )}
      </div>
    )
  },
  args: {
    notification: createNotification('Repository synced successfully', 'info'),
  },
}

export const Warning: Story = {
  render: (args) => {
    const [dismissed, setDismissed] = useState(false)
    const notification = createNotification(
      'This action cannot be undone',
      'warn',
      5000
    )
    
    return (
      <div>
        <NotificationItem
          {...args}
          notification={notification}
          onDismiss={(id) => {
            setDismissed(true)
            args.onDismiss?.(id)
          }}
        />
        {dismissed && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f5f5f5', borderRadius: '6px' }}>
            Notification dismissed
          </div>
        )}
      </div>
    )
  },
  args: {
    notification: createNotification('This action cannot be undone', 'warn'),
  },
}

export const Error: Story = {
  render: (args) => {
    const [dismissed, setDismissed] = useState(false)
    const notification = createNotification(
      'Failed to sync repository: Connection timeout',
      'error',
      5000
    )
    
    return (
      <div>
        <NotificationItem
          {...args}
          notification={notification}
          onDismiss={(id) => {
            setDismissed(true)
            args.onDismiss?.(id)
          }}
        />
        {dismissed && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f5f5f5', borderRadius: '6px' }}>
            Notification dismissed
          </div>
        )}
      </div>
    )
  },
  args: {
    notification: createNotification('Failed to sync repository: Connection timeout', 'error'),
  },
}

export const LongMessage: Story = {
  render: (args) => {
    const notification = createNotification(
      'This is a very long notification message that demonstrates how the notification component handles text that wraps across multiple lines. The notification should remain readable and properly formatted even with longer content.',
      'info'
    )
    
    return <NotificationItem {...args} notification={notification} onDismiss={args.onDismiss} />
  },
  args: {
    notification: createNotification(
      'This is a very long notification message that demonstrates how the notification component handles text that wraps across multiple lines.',
      'info'
    ),
  },
}

export const NoAutoDismiss: Story = {
  render: (args) => {
    const notification = createNotification(
      'This notification will not auto-dismiss. Click to close.',
      'info',
      undefined // No duration means no auto-dismiss
    )
    
    return <NotificationItem {...args} notification={notification} onDismiss={args.onDismiss} />
  },
  args: {
    notification: createNotification(
      'This notification will not auto-dismiss. Click to close.',
      'info',
      undefined
    ),
  },
}

export const AllTypes: Story = {
  render: () => {
    const [notifications, setNotifications] = useState<Notification[]>([
      createNotification('Info: Repository synced successfully', 'info'),
      createNotification('Warning: This action cannot be undone', 'warn'),
      createNotification('Error: Failed to sync repository', 'error'),
    ])

    const handleDismiss = (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={handleDismiss}
          />
        ))}
        {notifications.length === 0 && (
          <div style={{ padding: '1rem', background: '#f5f5f5', borderRadius: '6px', textAlign: 'center' }}>
            All notifications dismissed
          </div>
        )}
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows all three notification types side by side. Click on any notification to dismiss it.',
      },
    },
  },
}

