export interface Repository {
  id: string
  url: string
  credential_id: string | null
  enabled: boolean
  last_sync: string | null
  error: string | null
  size: number | null
}

export interface Credential {
  id: string
  username: string
  is_ssh_key: boolean
}

export interface CredentialFormData {
  username: string
  password?: string | null
  ssh_key?: string | null
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
  host?: string
  org?: string
  has_error?: boolean
  enabled?: boolean
}

export interface Stats {
  totalRepositories: number
  activeRepositories: number
  inactiveRepositories: number
  totalCredentials: number
  totalSize: number
}

export type TileLayout = 'wide' | 'square'

