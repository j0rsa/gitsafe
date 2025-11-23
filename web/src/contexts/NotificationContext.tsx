import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { Notification, NotificationType } from '../components/Notification'

interface NotificationContextType {
  showNotification: (message: string, type: NotificationType, duration?: number) => void
  showInfo: (message: string, duration?: number) => void
  showWarn: (message: string, duration?: number) => void
  showError: (message: string, duration?: number) => void
  dismissNotification: (id: string) => void
  notifications: Notification[]
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const showNotification = useCallback(
    (message: string, type: NotificationType, duration: number = 5000) => {
      const id = `${Date.now()}-${Math.random()}`
      const notification: Notification = {
        id,
        message,
        type,
        duration,
      }
      setNotifications((prev) => [...prev, notification])
    },
    []
  )

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      showNotification(message, 'info', duration)
    },
    [showNotification]
  )

  const showWarn = useCallback(
    (message: string, duration?: number) => {
      showNotification(message, 'warn', duration)
    },
    [showNotification]
  )

  const showError = useCallback(
    (message: string, duration?: number) => {
      showNotification(message, 'error', duration)
    },
    [showNotification]
  )

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        showInfo,
        showWarn,
        showError,
        dismissNotification,
        notifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

