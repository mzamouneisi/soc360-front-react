const ALLOWED_TYPES: Record<string, string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  pdf: ['application/pdf'],
}

/**
 * Un justificatif de note de frais est soit une image (PNG/JPG/JPEG), soit un PDF.
 * Le serveur revalide l'extension, le MIME et le contenu réel.
 */
export function isAllowedNoteFraisDocument(file: File): boolean {
  const name = file.name.toLowerCase()
  const dot = name.lastIndexOf('.')
  const extension = dot < 0 ? '' : name.slice(dot + 1)
  const allowedTypes = ALLOWED_TYPES[extension]
  if (!allowedTypes) return false
  if (file.type && !allowedTypes.includes(file.type.toLowerCase())) return false
  return true
}
