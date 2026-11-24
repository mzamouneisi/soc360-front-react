import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '../api/auth'
import type { UserDto } from '../api/types'
import { setUnauthorizedHandler } from '../api/client'
import { clearToken, getToken, setToken } from './token'

interface AuthState {
  user: UserDto | null
  initializing: boolean
  login: (username: string, password: string) => Promise<UserDto>
  googleLogin: (username: string, credential: string) => Promise<UserDto>
  logout: () => void
  setUser: (user: UserDto | null) => void
  refreshMe: () => Promise<UserDto | null>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
    })

    const token = getToken()
    if (!token) {
      setInitializing(false)
      return
    }

    authApi
      .me()
      .then(setUser)
      .catch(() => {
        clearToken()
        setUser(null)
      })
      .finally(() => setInitializing(false))

    return () => setUnauthorizedHandler(null)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const response = await authApi.login({ username, password })
    setToken(response.token)
    setUser(response.user)
    return response.user
  }, [])

  const googleLogin = useCallback(async (username: string, credential: string) => {
    const response = await authApi.googleLogin(username, credential)
    setToken(response.token)
    setUser(response.user)
    return response.user
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const refreshMe = useCallback(async () => {
    const updated = await authApi.me()
    setUser(updated)
    return updated
  }, [])

  const value = useMemo(
    () => ({ user, initializing, login, googleLogin, logout, setUser, refreshMe }),
    [user, initializing, login, googleLogin, logout, refreshMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider')
  }
  return ctx
}
