import type { Meta, StoryObj } from '@storybook/react'
import { NotificationProvider, useNotifications } from '../contexts/NotificationContext'
import { NotificationContainer } from './NotificationContainer'
import { useState } from 'react'

const meta: Meta = {
  title: 'Components/NotificationSystem',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj

// Component that uses the notification system
const NotificationDemo: React.FC = () => {
  const { showInfo, showWarn, showError, notifications, dismissNotification } = useNotifications()
  const [lastAction, setLastAction] = useState<string>('')

  const handleAction = (action: string, type: 'info' | 'warn' | 'error') => {
    const messages = {
      info: 'Repository synced successfully',
      warn: 'This action cannot be undone',
      error: 'Failed to sync repository: Connection timeout',
    }
    
    setLastAction(action)
    
    switch (type) {
      case 'info':
        showInfo(messages.info)
        break
      case 'warn':
        showWarn(messages.warn)
        break
      case 'error':
        showError(messages.error)
        break
    }
  }

  return (
    <div>
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Notification System Demo</h1>
        <p>This demonstrates the complete notification system using the NotificationProvider and useNotifications hook.</p>
        
        <div style={{ marginTop: '2rem' }}>
          <h2>Actions</h2>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleAction('info', 'info')}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Show Info
            </button>
            <button
              onClick={() => handleAction('warn', 'warn')}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f57c00',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Show Warning
            </button>
            <button
              onClick={() => handleAction('error', 'error')}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Show Error
            </button>
            <button
              onClick={() => {
                // Show multiple notifications at once
                showInfo('First notification')
                setTimeout(() => showWarn('Second notification'), 200)
                setTimeout(() => showError('Third notification'), 400)
                setLastAction('multiple')
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Show Multiple
            </button>
          </div>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '6px' }}>
          <h3>Status</h3>
          <p><strong>Active notifications:</strong> {notifications.length}</p>
          {lastAction && (
            <p><strong>Last action:</strong> {lastAction}</p>
          )}
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: '#e3f2fd', borderRadius: '6px' }}>
          <h3>Usage Example</h3>
          <pre style={{ background: '#fff', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
{`import { useNotifications } from '../contexts/NotificationContext'

const MyComponent = () => {
  const { showInfo, showWarn, showError } = useNotifications()
  
  const handleSuccess = () => {
    showInfo('Operation completed successfully')
  }
  
  const handleWarning = () => {
    showWarn('This action cannot be undone')
  }
  
  const handleError = () => {
    showError('Operation failed')
  }
  
  return (
    <div>
      {/* Your component content */}
    </div>
  )
}`}
          </pre>
        </div>
      </div>
    </div>
  )
}

export const FullSystem: Story = {
  render: () => (
    <NotificationProvider>
      <NotificationDemo />
    </NotificationProvider>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Complete notification system demonstration. Shows how to use the NotificationProvider and useNotifications hook to display notifications throughout your application.',
      },
    },
  },
}

