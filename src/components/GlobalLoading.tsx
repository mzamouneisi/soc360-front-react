import { tr } from '../i18n/translate'
import { useEffect, useState } from 'react'
import { setLoadingListener } from '../api/client'
import { Spinner } from './ui'

export function GlobalLoading() {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoadingListener(setLoading)
    return () => setLoadingListener(null)
  }, [])

  if (!loading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="flex items-center gap-3 rounded-xl bg-white px-6 py-4 shadow-xl">
        <Spinner className="h-6 w-6" />
        <span className="text-sm font-medium text-gray-700">{tr('GlobalLoading.chargement')}</span>
      </div>
    </div>
  )
}
