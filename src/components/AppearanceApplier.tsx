import { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useSoc } from '../soc/SocContext'
import { appearanceApi } from '../api/appearance'
import { applyAppearance } from '../lib/appearance'

/** Applique l'apparence effective (héritage utilisateur → société → SOC360) au document. */
export function AppearanceApplier() {
  const { user } = useAuth()
  const { selectedSocId } = useSoc()

  useEffect(() => {
    if (!user) return
    let cancelled = false
    appearanceApi
      .effective()
      .then((effective) => {
        if (!cancelled) applyAppearance(effective)
      })
      .catch(() => {
        // L'apparence est optionnelle : on conserve l'affichage par défaut en cas d'erreur.
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.socId, selectedSocId])

  return null
}
