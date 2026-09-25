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
  logout: () => void
  setUser: (user: UserDto | null) => void
  refreshMe: () => Promise<UserDto | null>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const doc = document.documentElement
    doc.style.fontSize = `${user?.fontSize && user.fontSize > 0 ? user.fontSize : 14}px`
    doc.dataset.theme = user?.theme || 'ocean'
    doc.style.setProperty('--table-header', user?.tableHeaderColor || '#f9fafb')
    doc.style.setProperty('--table-border', user?.tableBorderColor || '#e5e7eb')
    doc.style.setProperty('--btn-small-width', `${user?.buttonSmallWidth ?? 50}px`)
    doc.style.setProperty('--btn-large-width', `${user?.buttonLargeWidth ?? 100}px`)
    doc.style.setProperty('--btn-save-color', user?.buttonSaveColor || '#1d48eb')
    doc.style.setProperty('--btn-delete-color', user?.buttonDeleteColor || '#dc2626')
    doc.style.setProperty('--btn-cancel-color', user?.buttonCancelColor || '#ffffff')
    doc.style.setProperty('--btn-cancel-text-color', user?.buttonCancelTextColor || '#374151')
    doc.style.setProperty('--btn-submit-color', user?.buttonSubmitColor || '#e0e7ff')
    doc.style.setProperty('--btn-submit-text-color', user?.buttonSubmitTextColor || '#1d48eb')
    doc.style.setProperty('--btn-history-color', user?.buttonHistoryColor || '#e0e7ff')
    doc.style.setProperty('--btn-history-text-color', user?.buttonHistoryTextColor || '#1d48eb')
    doc.style.setProperty('--btn-ok-color', user?.buttonOkColor || '#16a34a')
    doc.style.setProperty('--btn-ok-text-color', user?.buttonOkTextColor || '#ffffff')
    doc.style.setProperty('--btn-new-color', user?.buttonNewColor || '#0ea5e9')
    doc.style.setProperty('--btn-new-text-color', user?.buttonNewTextColor || '#ffffff')
    doc.style.setProperty('--app-bg-color', user?.backgroundColor || '#bae6fd')
  }, [
    user?.fontSize,
    user?.theme,
    user?.tableHeaderColor,
    user?.tableBorderColor,
    user?.buttonSmallWidth,
    user?.buttonLargeWidth,
    user?.buttonSaveColor,
    user?.buttonDeleteColor,
    user?.buttonCancelColor,
    user?.buttonCancelTextColor,
    user?.buttonSubmitColor,
    user?.buttonSubmitTextColor,
    user?.buttonHistoryColor,
    user?.buttonHistoryTextColor,
    user?.buttonOkColor,
    user?.buttonOkTextColor,
    user?.buttonNewColor,
    user?.buttonNewTextColor,
    user?.backgroundColor,
  ])

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
    () => ({ user, initializing, login, logout, setUser, refreshMe }),
    [user, initializing, login, logout, refreshMe],
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
