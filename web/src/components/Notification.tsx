import React, { useEffect, useRef, useState } from 'react'
import './Notification.css'

export type NotificationType = 'info' | 'warn' | 'error'

export interface Notification {
  id: string
  message: string
  type: NotificationType
  duration?: number // Duration in milliseconds, undefined means no auto-dismiss
}

interface NotificationProps {
  notification: Notification
  onDismiss: (id: string) => void
}

export const NotificationItem: React.FC<NotificationProps> = ({ notification, onDismiss }) => {
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const remainingTimeRef = useRef<number | null>(null)

  // Initialize timer on mount or when notification changes
  useEffect(() => {
    // Reset remaining time when notification changes
    remainingTimeRef.current = null
    
    if (notification.duration !== undefined && notification.duration > 0 && !isHovered) {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      // Start with full duration
      startTimeRef.current = Date.now()

      // Set up the timer
      timerRef.current = setTimeout(() => {
        onDismiss(notification.id)
      }, notification.duration)

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
      }
    }
  }, [notification.id, notification.duration, onDismiss, isHovered])

  // Handle hover start - pause the timer
  const handleMouseEnter = () => {
    if (notification.duration !== undefined && notification.duration > 0 && timerRef.current && startTimeRef.current) {
      // Calculate remaining time
      const elapsed = Date.now() - startTimeRef.current
      remainingTimeRef.current = Math.max(0, notification.duration - elapsed)
      
      // Clear the timer
      clearTimeout(timerRef.current)
      timerRef.current = null
      
      setIsHovered(true)
    }
  }

  // Handle hover end - resume the timer with remaining time
  const handleMouseLeave = () => {
    if (notification.duration !== undefined && notification.duration > 0 && remainingTimeRef.current !== null) {
      setIsHovered(false)
      startTimeRef.current = Date.now()
      
      // Resume timer with remaining time
      timerRef.current = setTimeout(() => {
        onDismiss(notification.id)
      }, remainingTimeRef.current)
    }
  }

  const handleClick = () => {
    onDismiss(notification.id)
  }

  return (
    <div
      className={`notification notification-${notification.type}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="alert"
    >
      <div className="notification-content">
        <div className="notification-icon">
          {notification.type === 'error' && '✕'}
          {notification.type === 'warn' && '⚠'}
          {notification.type === 'info' && 'ℹ'}
        </div>
        <div className="notification-message">{notification.message}</div>
        <button className="notification-close" onClick={handleClick} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  )
}

