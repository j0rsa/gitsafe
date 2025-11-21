import type { Meta, StoryObj } from '@storybook/react'
import { Stats } from './Stats'

const meta: Meta<typeof Stats> = {
  title: 'Components/Stats',
  component: Stats,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Stats>

export const Default: Story = {
  args: {
    totalRepositories: 12,
    activeRepositories: 8,
    inactiveRepositories: 4,
    totalCredentials: 5,
  },
}

export const Empty: Story = {
  args: {
    totalRepositories: 0,
    activeRepositories: 0,
    inactiveRepositories: 0,
    totalCredentials: 0,
  },
}

export const ManyRepositories: Story = {
  args: {
    totalRepositories: 150,
    activeRepositories: 142,
    inactiveRepositories: 8,
    totalCredentials: 23,
  },
}

