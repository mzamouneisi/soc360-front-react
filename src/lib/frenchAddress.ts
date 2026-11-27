/**
 * Autocomplétion d'adresse française via l'API publique de la Base Adresse Nationale
 * (https://api-adresse.data.gouv.fr). Toutes les fonctions échouent silencieusement (null / [])
 * pour ne jamais bloquer la saisie si le service est indisponible.
 */

const SEARCH_URL = 'https://api-adresse.data.gouv.fr/search/'

interface ApiProperties {
  label?: string
  name?: string
  street?: string | null
  postcode?: string | null
  city?: string | null
}

interface ApiFeature {
  properties?: ApiProperties
}

interface ApiResponse {
  features?: ApiFeature[]
}

export function isFranceCountry(country: string | null | undefined): boolean {
  const value = (country ?? '').trim().toLowerCase()
  return value === '' || value === 'france' || value === 'fr' || value === 'f'
}

/** Minuscules + suppression des accents, pour comparer « commence par » sans tenir compte du clavier. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Sépare un éventuel numéro de voie du nom de rue saisi (ex. « 12 rue de Paris » →
 * { number: '12', street: 'rue de Paris' }). Le numéro peut être suivi de bis/ter/quater.
 */
export function splitStreetNumber(query: string): { number: string | null; street: string } {
  const match = query.match(/^\s*(\d+(?:\s*(?:bis|ter|quater))?)\s+(.+)$/i)
  if (!match) {
    return { number: null, street: query.trim() }
  }
  return { number: match[1].trim(), street: match[2].trim() }
}

async function search(query: string, params: Record<string, string>): Promise<ApiFeature[]> {
  if (!query.trim()) return []
  try {
    const url = new URL(SEARCH_URL)
    url.searchParams.set('q', query)
    url.searchParams.set('limit', params.limit ?? '5')
    if (params.type) url.searchParams.set('type', params.type)
    if (params.postcode) url.searchParams.set('postcode', params.postcode)
    const response = await fetch(url.toString())
    if (!response.ok) return []
    const data = (await response.json()) as ApiResponse
    return data.features ?? []
  } catch {
    return []
  }
}

/** Ville correspondant à un code postal français. */
export async function findCityByPostalCode(postalCode: string): Promise<string | null> {
  const features = await search(postalCode, { type: 'municipality', limit: '1' })
  const properties = features[0]?.properties
  return properties?.city ?? properties?.name ?? null
}

/** Code postal correspondant à une ville française. */
export async function findPostalCodeByCity(city: string): Promise<string | null> {
  const features = await search(city, { type: 'municipality', limit: '1' })
  return features[0]?.properties?.postcode ?? null
}

/** Vérifie que la rue existe bien pour le code postal / la ville donnés (France). */
export async function frenchAddressExists(
  streetInput: string,
  postalCode: string,
  city: string,
): Promise<boolean> {
  // Un éventuel numéro de voie est ignoré pour la vérification de l'existence de la rue.
  const { street } = splitStreetNumber(streetInput)
  const streetNormalized = normalize(street)
  if (streetNormalized.length < 3 || !/^\d{5}$/.test(postalCode.trim())) {
    return false
  }
  const features = await search(
    [street, postalCode, city].filter((part) => !!part && !!part.trim()).join(' '),
    { type: 'street', limit: '10', postcode: postalCode },
  )
  return features.some((feature) => {
    const properties = feature.properties
    const names = [properties?.street, properties?.name, properties?.label]
      .filter((value): value is string => !!value)
    const streetMatches = names.some((name) => {
      const normalized = normalize(name)
      return normalized === streetNormalized
        || normalized.startsWith(streetNormalized)
        || streetNormalized.startsWith(normalized)
    })
    const cityMatches = !properties?.city || normalize(properties.city) === normalize(city)
    return streetMatches && cityMatches
  })
}

export async function findStreetSuggestions(
  query: string,
  postalCode?: string | null,
  city?: string | null,
): Promise<string[]> {
  // Saisie possible : « rue de Paris » ou « 12 rue de Paris » (le numéro est conservé dans la
  // suggestion, mais ignoré pour la recherche et le filtre « commence par »).
  const { number, street } = splitStreetNumber(query)
  const prefix = normalize(street)
  if (prefix.length < 3) return []
  const composed = [street, postalCode, city].filter((part) => !!part && !!part.trim()).join(' ')
  const features = await search(composed, {
    type: 'street',
    limit: '10',
    ...(postalCode ? { postcode: postalCode } : {}),
  })
  const suggestions = features.map(
    (feature) => feature.properties?.street ?? feature.properties?.name
      ?? feature.properties?.label ?? null,
  )
  const unique = Array.from(new Set(suggestions.filter((value): value is string => !!value)))
  return unique
    .filter((value) => normalize(value).startsWith(prefix))
    .slice(0, 5)
    .map((value) => (number ? `${number} ${value}` : value))
}
