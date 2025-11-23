import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatBytes, formatRelativeTime, repoNameFromUrl, isSshUrl } from './utils'

describe('formatBytes', () => {
  it('should return "0 B" for null', () => {
    expect(formatBytes(null)).toBe('0 B')
  })

  it('should return "0 B" for undefined', () => {
    expect(formatBytes(undefined)).toBe('0 B')
  })

  it('should return "0 B" for 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('should format bytes correctly', () => {
    expect(formatBytes(1)).toBe('1 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB')
  })

  it('should format fractional sizes correctly', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5120)).toBe('5.0 KB')
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "Never" for null', () => {
    expect(formatRelativeTime(null)).toBe('Never')
  })

  it('should return "just now" for very recent dates', () => {
    const now = new Date()
    const oneSecondAgo = new Date(now.getTime() - 1000)
    vi.setSystemTime(now)
    expect(formatRelativeTime(oneSecondAgo.toISOString())).toBe('just now')
  })

  it('should format seconds correctly', () => {
    const now = new Date('2024-01-01T12:00:00Z')
    vi.setSystemTime(now)
    const thirtySecondsAgo = new Date('2024-01-01T11:59:30Z')
    expect(formatRelativeTime(thirtySecondsAgo.toISOString())).toBe('30 seconds ago')
  })

  it('should format minutes correctly', () => {
    const now = new Date('2024-01-01T12:00:00Z')
    vi.setSystemTime(now)
    const fiveMinutesAgo = new Date('2024-01-01T11:55:00Z')
    expect(formatRelativeTime(fiveMinutesAgo.toISOString())).toBe('5 minutes ago')
    
    const oneMinuteAgo = new Date('2024-01-01T11:59:00Z')
    expect(formatRelativeTime(oneMinuteAgo.toISOString())).toBe('1 minute ago')
  })

  it('should format hours correctly', () => {
    const now = new Date('2024-01-01T12:00:00Z')
    vi.setSystemTime(now)
    const twoHoursAgo = new Date('2024-01-01T10:00:00Z')
    expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe('2 hours ago')
    
    const oneHourAgo = new Date('2024-01-01T11:00:00Z')
    expect(formatRelativeTime(oneHourAgo.toISOString())).toBe('1 hour ago')
  })

  it('should format days correctly', () => {
    const now = new Date('2024-01-02T12:00:00Z')
    vi.setSystemTime(now)
    const yesterday = new Date('2024-01-01T12:00:00Z')
    expect(formatRelativeTime(yesterday.toISOString())).toBe('yesterday')
    
    const threeDaysAgo = new Date('2023-12-30T12:00:00Z')
    expect(formatRelativeTime(threeDaysAgo.toISOString())).toBe('3 days ago')
  })

  it('should format weeks correctly', () => {
    const now = new Date('2024-01-15T12:00:00Z')
    vi.setSystemTime(now)
    const oneWeekAgo = new Date('2024-01-08T12:00:00Z')
    expect(formatRelativeTime(oneWeekAgo.toISOString())).toBe('1 week ago')
    
    const twoWeeksAgo = new Date('2024-01-01T12:00:00Z')
    expect(formatRelativeTime(twoWeeksAgo.toISOString())).toBe('2 weeks ago')
  })

  it('should format months correctly', () => {
    const now = new Date('2024-03-15T12:00:00Z')
    vi.setSystemTime(now)
    // Use 32 days ago to ensure it's in the months category (not weeks, since 30 days = 4 weeks)
    const oneMonthAgo = new Date('2024-02-12T12:00:00Z')
    expect(formatRelativeTime(oneMonthAgo.toISOString())).toBe('1 month ago')
    
    const twoMonthsAgo = new Date('2024-01-12T12:00:00Z')
    expect(formatRelativeTime(twoMonthsAgo.toISOString())).toBe('2 months ago')
  })

  it('should format years correctly', () => {
    const now = new Date('2024-01-01T12:00:00Z')
    vi.setSystemTime(now)
    const oneYearAgo = new Date('2023-01-01T12:00:00Z')
    expect(formatRelativeTime(oneYearAgo.toISOString())).toBe('1 year ago')
    
    const twoYearsAgo = new Date('2022-01-01T12:00:00Z')
    expect(formatRelativeTime(twoYearsAgo.toISOString())).toBe('2 years ago')
  })

  it('should return "Invalid date" for invalid date strings', () => {
    expect(formatRelativeTime('invalid-date')).toBe('Invalid date')
    expect(formatRelativeTime('not-a-date')).toBe('Invalid date')
  })

  it('should return "Never" for empty string', () => {
    expect(formatRelativeTime('')).toBe('Never')
  })
})

describe('repoNameFromUrl', () => {
  describe('HTTP/HTTPS URLs', () => {
    it('should generate ID from standard GitHub URL', () => {
      expect(repoNameFromUrl('https://github.com/example/repo1')).toBe('github_com-example-repo1')
    })

    it('should generate ID from URL with .git suffix', () => {
      expect(repoNameFromUrl('https://github.com/user/repo.git')).toBe('github_com-user-repo')
    })

    it('should generate ID from GitLab URL', () => {
      expect(repoNameFromUrl('https://gitlab.com/group/project')).toBe('gitlab_com-group-project')
    })

    it('should generate ID from URL with multiple path segments', () => {
      expect(repoNameFromUrl('https://github.com/org/team/repo')).toBe('github_com-org-team-repo')
    })

    it('should generate ID from URL with port', () => {
      expect(repoNameFromUrl('https://git.example.com:8443/user/repo')).toBe('git_example_com-user-repo')
    })

    it('should handle URLs with trailing slash', () => {
      expect(repoNameFromUrl('https://github.com/user/repo/')).toBe('github_com-user-repo')
    })

    it('should handle URLs with special characters', () => {
      expect(repoNameFromUrl('https://github.com/user-name/repo_name')).toBe('github_com-user-name-repo_name')
      expect(repoNameFromUrl('https://github.com/user123/repo456')).toBe('github_com-user123-repo456')
    })

    it('should handle empty path', () => {
      expect(repoNameFromUrl('https://github.com')).toBe('github_com')
    })
  })

  describe('SSH URLs', () => {
    it('should generate ID from SSH GitHub URL', () => {
      expect(repoNameFromUrl('git@github.com:example/repo1.git')).toBe('github_com-example-repo1')
    })

    it('should generate ID from SSH URL without .git suffix', () => {
      expect(repoNameFromUrl('git@gitlab.com:group/project')).toBe('gitlab_com-group-project')
    })

    it('should generate ID from SSH URL with multiple path segments', () => {
      expect(repoNameFromUrl('git@github.com:org/team/repo.git')).toBe('github_com-org-team-repo')
    })

    it('should handle SSH URLs with special characters', () => {
      expect(repoNameFromUrl('git@github.com:user-name/repo_name.git')).toBe('github_com-user-name-repo_name')
      expect(repoNameFromUrl('git@github.com:user123/repo456.git')).toBe('github_com-user123-repo456')
    })

    it('should handle SSH URLs with custom hostnames', () => {
      expect(repoNameFromUrl('git@git.example.com:user/repo.git')).toBe('git_example_com-user-repo')
    })
  })

  describe('Edge cases', () => {
    it('should handle URLs with multiple dots in domain', () => {
      expect(repoNameFromUrl('https://subdomain.example.com/user/repo')).toBe('subdomain_example_com-user-repo')
      expect(repoNameFromUrl('git@subdomain.example.com:user/repo.git')).toBe('subdomain_example_com-user-repo')
    })

    it('should handle URLs with .git in path segments', () => {
      // .git is only stripped if it's at the end of the segment
      // So repo.git.backup keeps .git because it's not at the end (dots remain in segment name)
      expect(repoNameFromUrl('https://github.com/user/repo.git.backup')).toBe('github_com-user-repo.git.backup')
      
      // But repo.git will have .git stripped
      expect(repoNameFromUrl('https://github.com/user/repo.git')).toBe('github_com-user-repo')
    })

    it('should handle malformed URLs gracefully', () => {
      // Should not throw, but may return empty or partial result
      expect(() => repoNameFromUrl('not-a-url')).not.toThrow()
    })
  })
})

describe('isSshUrl', () => {
  it('should return true for SSH URLs', () => {
    expect(isSshUrl('git@github.com:user/repo.git')).toBe(true)
    expect(isSshUrl('git@gitlab.com:group/project.git')).toBe(true)
    expect(isSshUrl('user@example.com:path/to/repo.git')).toBe(true)
  })

  it('should return false for HTTP/HTTPS URLs', () => {
    expect(isSshUrl('https://github.com/user/repo.git')).toBe(false)
    expect(isSshUrl('http://github.com/user/repo.git')).toBe(false)
    expect(isSshUrl('https://gitlab.com/group/project.git')).toBe(false)
  })

  it('should return false for HTTP URLs with basic auth', () => {
    expect(isSshUrl('https://user:pass@github.com/user/repo.git')).toBe(false)
    expect(isSshUrl('http://username:password@gitlab.com/group/project.git')).toBe(false)
    expect(isSshUrl('https://token@github.com/user/repo.git')).toBe(false)
  })

  it('should return false for URLs without @ sign', () => {
    expect(isSshUrl('https://github.com/user/repo.git')).toBe(false)
    expect(isSshUrl('http://example.com/repo.git')).toBe(false)
  })
})

