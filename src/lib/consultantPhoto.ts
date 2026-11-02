export const MAX_CONSULTANT_PHOTO_BYTES = 5 * 1024 * 1024

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg']
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg']

export type ConsultantPhotoValidationError = 'format' | 'taille' | null

export function validateConsultantPhotoFile(
  file: File,
): ConsultantPhotoValidationError {
  const extension = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
    : ''
  if (!ALLOWED_EXTENSIONS.includes(extension)) return 'format'
  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) return 'format'
  if (file.size > MAX_CONSULTANT_PHOTO_BYTES) return 'taille'
  return null
}

export function consultantInitials(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const first = (firstName ?? '').trim().charAt(0).toUpperCase()
  const last = (lastName ?? '').trim().charAt(0).toUpperCase()
  return (first + last).trim() || '?'
}
