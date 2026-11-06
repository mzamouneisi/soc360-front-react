import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function AdminAccountRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user || user.username !== 'admin') {
    return <Navigate to="/" replace />
  }
  return children
}
