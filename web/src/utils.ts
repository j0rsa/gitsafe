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
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }
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

/**
 * Generates a repository ID from a Git URL (for use as identifier).
 * 
 * Matches the logic from api/src/git.rs::repo_id_from_url
 * 
 * The ID is constructed by:
 * 1. Extracting the domain and replacing dots with underscores
 * 2. Extracting path segments (user/org and repository name)
 * 3. Joining all parts with dashes
 * 4. Removing .git suffix if present
 * 
 * Supports both HTTP/HTTPS URLs and SSH URLs (git@host:path)
 * 
 * @param url - The Git repository URL
 * @returns A string representation of the repository ID suitable for use as an identifier
 * 
 * @example
 * repoNameFromUrl("https://github.com/example/repo1")
 * // Returns: "github_com-example-repo1"
 * 
 * @example
 * repoNameFromUrl("https://gitlab.com/user/org/my-repo.git")
 * // Returns: "gitlab_com-user-org-my-repo"
 * 
 * @example
 * repoNameFromUrl("git@github.com:example/repo1.git")
 * // Returns: "github_com-example-repo1"
 */
export function repoNameFromUrl(url: string): string {
  const parts: string[] = []

  // Check for SSH URL format: git@host:path
  const atIndex = url.indexOf('@')
  if (atIndex !== -1) {
    const afterAt = url.substring(atIndex + 1)
    const colonIndex = afterAt.indexOf(':')
    if (colonIndex !== -1) {
      const host = afterAt.substring(0, colonIndex)
      const domain = host.replace(/\./g, '_')
      parts.push(domain)

      const path = afterAt.substring(colonIndex + 1)
      const pathSegments = path.split('/').filter(segment => segment.length > 0)
      
      for (const segment of pathSegments) {
        const cleanSegment = segment.endsWith('.git') 
          ? segment.slice(0, -4) 
          : segment
        parts.push(cleanSegment)
      }
      return parts.join('-')
    }
  }

  // Parse HTTP/HTTPS URL
  try {
    const parsedUrl = new URL(url)
    
    // Extract domain (replace dots with underscores)
    if (parsedUrl.hostname) {
      const domain = parsedUrl.hostname.replace(/\./g, '_')
      parts.push(domain)
    }

    // Extract path segments (user/org and repo name)
    const pathSegments = parsedUrl.pathname
      .split('/')
      .filter(segment => segment.length > 0)

    for (const segment of pathSegments) {
      // Remove .git suffix if present
      const cleanSegment = segment.endsWith('.git') 
        ? segment.slice(0, -4) 
        : segment
      parts.push(cleanSegment)
    }
  } catch {
    // Fallback: try to extract manually
    const protocolMatch = url.match(/^https?:\/\//)
    if (protocolMatch) {
      const afterProtocol = url.substring(protocolMatch[0].length)
      const pathStart = afterProtocol.indexOf('/')
      
      if (pathStart !== -1) {
        const domain = afterProtocol.substring(0, pathStart).replace(/\./g, '_')
        parts.push(domain)

        const path = afterProtocol.substring(pathStart + 1)
        const pathSegments = path.split('/').filter(segment => segment.length > 0)
        
        for (const segment of pathSegments) {
          const cleanSegment = segment.endsWith('.git') 
            ? segment.slice(0, -4) 
            : segment
          parts.push(cleanSegment)
        }
      }
    }
  }

  return parts.join('-')
}

/**
 * Determines if a Git URL is an SSH URL (git@host:path) or HTTP/HTTPS URL.
 * 
 * SSH URLs have the format: git@host:path
 * HTTP URLs with basic auth have the format: https://user:pass@host/path
 * 
 * The key difference: SSH URLs have `:` after the host (before path),
 * while HTTP URLs with basic auth have `/` after the host.
 * 
 * @param url - The Git repository URL
 * @returns true if the URL is an SSH URL, false if it's HTTP/HTTPS
 * 
 * @example
 * isSshUrl("git@github.com:user/repo.git")
 * // Returns: true
 * 
 * @example
 * isSshUrl("https://github.com/user/repo.git")
 * // Returns: false
 * 
 * @example
 * isSshUrl("https://user:pass@github.com/user/repo.git")
 * // Returns: false (HTTP with basic auth)
 */
export function isSshUrl(url: string): boolean {
  const atIndex = url.indexOf('@')
  if (atIndex === -1) {
    return false
  }
  
  const afterAt = url.substring(atIndex + 1)
  const colonIndex = afterAt.indexOf(':')
  const slashIndex = afterAt.indexOf('/')
  
  if (colonIndex === -1) {
    // No ':' found, so it's not SSH format
    return false
  }
  
  if (slashIndex === -1) {
    // No '/' found, so ':' indicates SSH format
    return true
  }
  
  // If ':' comes before '/', it's SSH format (git@host:path)
  // If '/' comes before ':', it's HTTP with basic auth (https://user:pass@host/path)
  return colonIndex < slashIndex
}

