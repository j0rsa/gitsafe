import type { Repository, Credential, LoginRequest, LoginResponse, SearchFilters } from '../types'

const API_BASE = '/api'

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
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
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
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `HTTP error! status: ${response.status}`)
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
    if (filters?.url) params.append('url', filters.url)
    if (filters?.has_error !== undefined) {
      params.append('has_error', filters.has_error.toString())
    }
    const query = params.toString()
    return this.request<Repository[]>(`/repositories${query ? `?${query}` : ''}`)
  }

  async getCredentials(): Promise<Credential[]> {
    return this.request<Credential[]>('/credentials')
  }

  async deleteRepository(id: string): Promise<void> {
    await this.request(`/repositories/${id}`, { method: 'DELETE' })
  }

  async syncRepository(repositoryId: string): Promise<{ message: string; archive: string }> {
    return this.request('/sync', {
      method: 'POST',
      body: JSON.stringify({ repository_id: repositoryId }),
    })
  }
}

export const apiClient = new ApiClient()

