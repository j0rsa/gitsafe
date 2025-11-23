import React, { useEffect, useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { apiClient } from './api/client'
import './App.css'

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    // Check if we have a stored token
    const token = apiClient.getToken()
    if (token) {
      setIsAuthenticated(true)
      setIsLoading(false)
    } else {
      // Auto-login with admin/empty password if no token
      const attemptAutoLogin = async () => {
        try {
          await apiClient.login({ username: 'admin', password: '' })
          setIsAuthenticated(true)
        } catch (err) {
          // Auto-login failed, show login form
          setLoginError(null) // Don't show error for auto-login failure
        } finally {
          setIsLoading(false)
        }
      }
      attemptAutoLogin()
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    try {
      await apiClient.login({ username, password })
      setIsAuthenticated(true)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
      apiClient.clearToken()
    }
  }


  if (isLoading) {
    return (
      <div className="app-loading">
        <div>Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img src="/assets/logo.png" alt="GitSafe Logo" className="login-logo" />
            <h2>GitSafe Login</h2>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {loginError && <div className="error-message">{loginError}</div>}
            <button type="submit" className="login-btn">
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Dashboard />
    </div>
  )
}

export default App

