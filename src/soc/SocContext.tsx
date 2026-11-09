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
import { getCurrentSocId, setCurrentSocId } from '../api/client'
import type { AddSocPayload, SocLiteDto } from '../api/types'
import { useAuth } from '../auth/AuthContext'

interface SocState {
  socs: SocLiteDto[]
  selectedSocId: number | null
  selectedSoc: SocLiteDto | null
  favoriteSocId: number | null
  favoriteSoc: SocLiteDto | null
  /** Incrémenté à chaque rafraîchissement : force le rechargement du logo (ex. remplacement). */
  socRevision: number
  loading: boolean
  refreshSocs: () => Promise<void>
  selectSoc: (id: number) => void
  setFavoriteSoc: (id: number) => Promise<void>
  addSoc: (payload: AddSocPayload) => Promise<SocLiteDto>
  canAddSoc: boolean
}

const SocContext = createContext<SocState | undefined>(undefined)

const STORAGE_KEY = 'soc360.selectedSocId'

export function SocProvider({ children }: { children: ReactNode }) {
  const { user, refreshMe } = useAuth()
  const [socs, setSocs] = useState<SocLiteDto[]>([])
  const [selectedSocId, setSelectedSocIdState] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? Number(raw) : null
  })
  const [loading, setLoading] = useState(false)
  const [socRevision, setSocRevision] = useState(0)

  const applySelection = useCallback((id: number | null) => {
    setSelectedSocIdState(id)
    setCurrentSocId(id)
    if (id != null) {
      localStorage.setItem(STORAGE_KEY, String(id))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const refreshSocs = useCallback(async () => {
    if (!user) {
      setSocs([])
      applySelection(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const list = await authApi.mySocs()
      setSocs(list)
      setSocRevision((value) => value + 1)
      const favoriteId = user.socId
      const favoriteValid = favoriteId != null && list.some((e) => e.id === favoriteId)
      const stored = getCurrentSocId()
      const storedValid = stored != null && list.some((e) => e.id === stored)
      const next = favoriteValid
        ? favoriteId
        : storedValid
          ? stored
          : (list[0]?.id ?? null)
      if (next !== getCurrentSocId()) {
        applySelection(next)
      }
    } finally {
      setLoading(false)
    }
  }, [user, applySelection])

  useEffect(() => {
    void refreshSocs()
  }, [refreshSocs])

  const selectSoc = useCallback(
    (id: number) => {
      if (socs.some((e) => e.id === id)) {
        applySelection(id)
      }
    },
    [socs, applySelection],
  )

  const addSoc = useCallback(
    async (payload: AddSocPayload) => {
      const created = await authApi.addSoc(payload)
      const list = await authApi.mySocs()
      setSocs(list)
      applySelection(created.id)
      return created
    },
    [applySelection],
  )

  const setFavoriteSoc = useCallback(
    async (socId: number) => {
      await authApi.setFavoriteSoc(socId)
      await refreshMe()
      void refreshSocs()
    },
    [refreshMe, refreshSocs],
  )

  const selectedSoc = socs.find((e) => e.id === selectedSocId) ?? null
  const favoriteSocId = user?.socId ?? null
  const favoriteSoc = socs.find((e) => e.id === favoriteSocId) ?? null

  const value = useMemo<SocState>(
    () => ({
      socs,
      selectedSocId,
      selectedSoc,
      favoriteSocId,
      favoriteSoc,
      socRevision,
      loading,
      refreshSocs,
      selectSoc,
      setFavoriteSoc,
      addSoc,
      canAddSoc: user?.role === 'RESPONSIBLE_SOC',
    }),
    [
      socs,
      selectedSocId,
      selectedSoc,
      favoriteSocId,
      favoriteSoc,
      socRevision,
      loading,
      refreshSocs,
      selectSoc,
      setFavoriteSoc,
      addSoc,
      user?.role,
    ],
  )

  return <SocContext.Provider value={value}>{children}</SocContext.Provider>
}

export function useSoc(): SocState {
  const ctx = useContext(SocContext)
  if (!ctx) {
    throw new Error('useSoc doit être utilisé dans un SocProvider')
  }
  return ctx
}
