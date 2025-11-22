import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { CredentialManagementDialog } from './CredentialManagementDialog'

const meta: Meta<typeof CredentialManagementDialog> = {
  title: 'Components/CredentialManagementDialog',
  component: CredentialManagementDialog,
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
type Story = StoryObj<typeof CredentialManagementDialog>

const DialogWrapper = (args: Story['args']) => {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <>
      <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px', maxWidth: '600px' }}>
        <p><strong>Note:</strong> This component uses the actual API client. In Storybook, API calls will fail unless the backend is running.</p>
        <p>The dialog demonstrates the UI and validation behavior. Try submitting without required fields to see validation errors.</p>
      </div>
      <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem', marginBottom: '1rem' }}>
        Open Credential Management Dialog
      </button>
      <CredentialManagementDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        {...args}
      />
    </>
  )
}

export const Default: Story = {
  render: () => <DialogWrapper />,
}

export const ValidationErrors: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    return (
      <>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fef2f2', borderRadius: '8px', maxWidth: '600px' }}>
          <p><strong>Validation Demo:</strong></p>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>Username is required</li>
            <li>At least one of Password or SSH Key is required for new credentials</li>
            <li>Try submitting with empty fields to see validation errors</li>
          </ul>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem', marginBottom: '1rem' }}>
          Open Dialog (Show Validation)
        </button>
        <CredentialManagementDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </>
    )
  },
}

export const PasswordOnly: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    return (
      <>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', maxWidth: '600px' }}>
          <p><strong>Password Authentication:</strong></p>
          <p>You can create a credential with only a password (no SSH key required).</p>
          <p>Fill in username and password, leave SSH key empty.</p>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem', marginBottom: '1rem' }}>
          Open Dialog
        </button>
        <CredentialManagementDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </>
    )
  },
}

export const SshKeyOnly: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    return (
      <>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', maxWidth: '600px' }}>
          <p><strong>SSH Key Authentication:</strong></p>
          <p>You can create a credential with only an SSH key (no password required).</p>
          <p>Fill in username and paste SSH key content, leave password empty.</p>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem', marginBottom: '1rem' }}>
          Open Dialog
        </button>
        <CredentialManagementDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </>
    )
  },
}

export const BothMethods: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    return (
      <>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', maxWidth: '600px' }}>
          <p><strong>Both Authentication Methods:</strong></p>
          <p>You can also provide both password and SSH key for maximum flexibility.</p>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem', marginBottom: '1rem' }}>
          Open Dialog
        </button>
        <CredentialManagementDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </>
    )
  },
}

export const EditMode: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)

    return (
      <>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fef3c7', borderRadius: '8px', maxWidth: '600px' }}>
          <p><strong>Edit Mode:</strong></p>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>Click "Edit" on any credential to enter edit mode</li>
            <li>Password and SSH key fields can be left empty to keep existing values</li>
            <li>If you provide a password but no SSH key, the SSH key will be deleted</li>
            <li>At least one authentication method must remain after update</li>
          </ul>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ padding: '1rem', fontSize: '1rem', marginBottom: '1rem' }}>
          Open Dialog
        </button>
        <CredentialManagementDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </>
    )
  },
}

