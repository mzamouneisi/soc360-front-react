export const MAX_SOC_LOGO_BYTES = 2 * 1024 * 1024

export const DEFAULT_SOC_LOGO = `${import.meta.env.BASE_URL ?? '/'}favicon.svg`

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg']
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg']

export type SocLogoValidationError = 'format' | 'taille' | null

/**
 * Validation rapide côté client (extension, type MIME, taille). Le serveur vérifie en plus
 * le contenu réel du fichier (signature binaire PNG/JPEG).
 */
export function validateSocLogoFile(file: File): SocLogoValidationError {
  const extension = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
    : ''
  if (!ALLOWED_EXTENSIONS.includes(extension)) return 'format'
  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) return 'format'
  if (file.size > MAX_SOC_LOGO_BYTES) return 'taille'
  return null
}
