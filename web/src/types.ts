export interface Repository {
  id: string
  url: string
  credential_id: string | null
  enabled: boolean
  last_sync: string | null
  error: string | null
}

export interface Credential {
  id: string
  username: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
}

export interface SearchFilters {
  name?: string
  url?: string
  has_error?: boolean
}

export interface Stats {
  totalRepositories: number
  activeRepositories: number
  inactiveRepositories: number
  totalCredentials: number
}

