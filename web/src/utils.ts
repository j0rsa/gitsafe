/**
 * Format bytes to human-readable size string
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) {
    return '0 B'
  }

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}

/**
 * Format date to relative time string (e.g., "2 minutes ago", "yesterday")
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) {
    return 'Never'
  }

  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSeconds < 60) {
      return diffSeconds <= 1 ? 'just now' : `${diffSeconds} seconds ago`
    }

    if (diffMinutes < 60) {
      return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`
    }

    if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
    }

    if (diffDays === 1) {
      return 'yesterday'
    }

    if (diffDays < 7) {
      return `${diffDays} days ago`
    }

    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
    }

    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return months === 1 ? '1 month ago' : `${months} months ago`
    }

    const years = Math.floor(diffDays / 365)
    return years === 1 ? '1 year ago' : `${years} years ago`
  } catch {
    return 'Invalid date'
  }
}

