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
