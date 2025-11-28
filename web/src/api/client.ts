import type { Repository, Credential, LoginRequest, LoginResponse, SearchFilters } from '../types'

const API_BASE = 'api'

class ApiClient {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
    localStorage.setItem('auth_token', token)
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token')
    }
    return this.token
  }

  clearToken() {
    this.token = null
    localStorage.removeItem('auth_token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      this.clearToken()
      throw new Error('Unauthorized')
    }

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`
      try {
        const errorData = await response.json()
        // Handle different error response formats
        if (errorData.error) {
          errorMessage = errorData.error
        } else if (errorData.message) {
          errorMessage = errorData.message
        } else if (typeof errorData === 'string') {
          errorMessage = errorData
        }
      } catch {
        // If response is not JSON, try to get text
        try {
          const text = await response.text()
          if (text) {
            errorMessage = text
          }
        } catch {
          // Fallback to status-based message
          if (response.status === 400) {
            errorMessage = 'Bad request. Please check your input.'
          } else if (response.status === 401) {
            errorMessage = 'Unauthorized. Please log in again.'
          } else if (response.status === 404) {
            errorMessage = 'Resource not found.'
          } else if (response.status === 409) {
            errorMessage = 'Repository already exists.'
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Please try again later.'
          }
        }
      }
      throw new Error(errorMessage)
    }

    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    this.setToken(response.token)
    return response
  }

  async getRepositories(filters?: SearchFilters): Promise<Repository[]> {
    const params = new URLSearchParams()
    if (filters?.name) params.append('name', filters.name)
    if (filters?.host) params.append('host', filters.host)
    if (filters?.org) params.append('org', filters.org)
    if (filters?.has_error !== undefined) {
      params.append('has_error', filters.has_error.toString())
    }
    const query = params.toString()
    return this.request<Repository[]>(`/repositories${query ? `?${query}` : ''}`)
  }

  async getCredentials(): Promise<Credential[]> {
    return this.request<Credential[]>('/credentials')
  }

  async addCredential(data: { username: string; password: string; ssh_key?: string | null; id?: string | null }): Promise<Credential> {
    return this.request<Credential>('/credentials', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCredential(
    id: string,
    data: { username: string; password: string; ssh_key?: string | null }
  ): Promise<Credential> {
    return this.request<Credential>(`/credentials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteCredential(id: string): Promise<void> {
    await this.request(`/credentials/${id}`, { method: 'DELETE' })
  }

  async deleteRepository(id: string): Promise<void> {
    await this.request(`/repositories/${id}`, { method: 'DELETE' })
  }

  async syncRepository(repositoryId: string): Promise<{ message: string; archive: string; commit_message?: string; commit_hash?: string; skipped?: boolean }> {
    return this.request('/sync', {
      method: 'POST',
      body: JSON.stringify({ repository_id: repositoryId }),
    })
  }

  async updateRepository(
    id: string,
    updates: { enabled?: boolean; credential_id?: string | null }
  ): Promise<Repository> {
    return this.request(`/repositories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async addRepository(data: { url: string; credential_id?: string | null; id?: string | null }): Promise<Repository> {
    return this.request('/repositories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export const apiClient = new ApiClient()

