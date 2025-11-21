import React from 'react'
import './Stats.css'

export interface StatsProps {
  totalRepositories: number
  activeRepositories: number
  inactiveRepositories: number
  totalCredentials: number
}

export const Stats: React.FC<StatsProps> = ({
  totalRepositories,
  activeRepositories,
  inactiveRepositories,
  totalCredentials,
}) => {
  return (
    <div className="stats-container">
      <div className="stat-card">
        <div className="stat-label">Total Repositories</div>
        <div className="stat-value">{totalRepositories}</div>
      </div>
      <div className="stat-card stat-card-active">
        <div className="stat-label">Active</div>
        <div className="stat-value">{activeRepositories}</div>
      </div>
      <div className="stat-card stat-card-inactive">
        <div className="stat-label">Inactive</div>
        <div className="stat-value">{inactiveRepositories}</div>
      </div>
      <div className="stat-card stat-card-credentials">
        <div className="stat-label">Credentials</div>
        <div className="stat-value">{totalCredentials}</div>
      </div>
    </div>
  )
}

