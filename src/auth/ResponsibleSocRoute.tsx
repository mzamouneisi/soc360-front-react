import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ResponsibleSocRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user || user.role !== 'RESPONSIBLE_SOC') {
    return <Navigate to="/" replace />
  }
  return children
}
