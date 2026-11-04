import { useEffect, useState } from 'react'
import { consultantsApi } from '../api/consultants'
import { consultantInitials } from '../lib/consultantPhoto'

interface UserAvatarProps {
  userId: number
  firstName?: string | null
  lastName?: string | null
  hasPhoto?: boolean
  className?: string
  id?: string
}

/** Avatar de l'utilisateur courant : photo de profil si elle existe, sinon ses initiales. */
export function UserAvatar({
  userId,
  firstName,
  lastName,
  hasPhoto,
  className = 'h-8 w-8',
  id,
}: UserAvatarProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setFailed(false)
    if (!hasPhoto) {
      setUrl(null)
      return () => {
        active = false
      }
    }
    consultantsApi
      .photoUrl(userId)
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
  }, [userId, hasPhoto])

  const initials = consultantInitials(firstName, lastName)
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  return (
    <div
      id={id}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-xs font-bold text-white ${className}`}
    >
      {url && !failed ? (
        <img src={url} alt={fullName} className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
