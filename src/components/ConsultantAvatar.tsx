import { useEffect, useState } from 'react'
import { consultantsApi } from '../api/consultants'
import type { ConsultantDto } from '../api/types'
import { consultantInitials } from '../lib/consultantPhoto'
import { tr } from '../i18n/translate'

interface ConsultantAvatarProps {
  consultant: ConsultantDto
  className?: string
}

export function ConsultantAvatar({ consultant, className = 'h-10 w-10' }: ConsultantAvatarProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    if (!consultant.hasPhoto) {
      setUrl(null)
      return () => {
        active = false
      }
    }
    consultantsApi
      .photoUrl(consultant.id)
      .then((value) => {
        if (!active) {
          URL.revokeObjectURL(value)
          return
        }
        objectUrl = value
        setUrl(value)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [consultant.id, consultant.hasPhoto])

  const initials = consultantInitials(consultant.firstName, consultant.lastName)
  const fullName = consultant.firstName && consultant.lastName
    ? `${consultant.firstName} ${consultant.lastName}`
    : consultant.firstName ?? consultant.lastName ?? ''

  return (
    <div
      id={`Consultants.avatar.${consultant.id}`}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-800 ${className}`}
    >
      {url && !failed ? (
        <img src={url} alt={fullName} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-medium">{initials}</span>
      )}
    </div>
  )
}

export function ConsultantPhotoLabel() {
  return <span id="Consultants.photo.label">{tr('Consultants.photo')}</span>
}
