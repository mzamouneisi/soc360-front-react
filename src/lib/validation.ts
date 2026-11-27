/**
 * Validation d'une adresse de site web (http(s):// ou domaine contenant un point).
 * Une valeur vide est considérée invalide (utile pour le flag ; à filtrer avant l'enregistrement).
 */
export function isValidWebsite(value: string | null | undefined): boolean {
  const website = (value ?? '').trim()
  if (!website) {
    return false
  }
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`)
    return !!url.hostname && url.hostname.includes('.')
  } catch {
    return false
  }
}

/**
 * Validation d'une adresse email (format simple). Une valeur vide est considérée valide
 * (champ facultatif).
 */
export function isValidEmail(value: string | null | undefined): boolean {
  const email = (value ?? '').trim()
  if (!email) {
    return true
  }
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

/**
 * Validation d'un numéro de téléphone : « + » optionnel en tête, chiffres, espaces, points,
 * tirets et parenthèses, avec entre 6 et 15 chiffres. Une valeur vide est considérée valide
 * (champ facultatif).
 */
export function isValidPhone(value: string | null | undefined): boolean {
  const phone = (value ?? '').trim()
  if (!phone) {
    return true
  }
  if (!/^\+?[0-9 ().\-]+$/.test(phone)) {
    return false
  }
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 6 && digits.length <= 15
}
