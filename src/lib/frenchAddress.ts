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

// La BAN écrit souvent les nombres en chiffres (« Rue des 2 Communes ») alors que l'utilisateur
// peut les saisir en lettres : on harmonise les deux formes pour la comparaison.
const NUMBER_WORDS: Record<string, string> = {
  zero: '0', un: '1', une: '1', deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6',
  sept: '7', huit: '8', neuf: '9', dix: '10', onze: '11', douze: '12', treize: '13',
  quatorze: '14', quinze: '15', seize: '16', 'dix-sept': '17', 'dix-huit': '18',
  'dix-neuf': '19', vingt: '20', trente: '30', quarante: '40', cinquante: '50',
  soixante: '60', cent: '100', cents: '100', mille: '1000',
}
const NUMBER_WORDS_PATTERN = new RegExp(
  `\\b(${Object.keys(NUMBER_WORDS)
    .sort((first, second) => second.length - first.length)
    .join('|')})\\b`,
  'g',
)

/** Normalisation dédiée aux libellés d'adresse (accents, casse et nombres en lettres/chiffres). */
export function normalizeAddressText(value: string): string {
  return normalize(value).replace(NUMBER_WORDS_PATTERN, (word) => NUMBER_WORDS[word] ?? word)
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

/** Vérifie que la rue existe bien pour le code postal donné (France). */
export async function frenchStreetExists(
  streetInput: string,
  postalCode: string,
): Promise<boolean> {
  const { street } = splitStreetNumber(streetInput)
  const streetNormalized = normalizeAddressText(street)
  if (streetNormalized.length < 3 || !/^\d{5}$/.test(postalCode.trim())) {
    return false
  }
  const features = await search(
    [street, postalCode].filter((part) => !!part && !!part.trim()).join(' '),
    { type: 'street', limit: '10', postcode: postalCode },
  )
  return features.some((feature) => {
    const properties = feature.properties
    const names = [properties?.street, properties?.name, properties?.label]
      .filter((value): value is string => !!value)
    return names.some((name) => {
      const normalized = normalizeAddressText(name)
      return normalized === streetNormalized
        || normalized.startsWith(streetNormalized)
        || streetNormalized.startsWith(normalized)
    })
  })
}

/** Vérifie que la ville correspond bien au code postal français. */
export async function frenchCityMatchesPostalCode(
  city: string,
  postalCode: string,
): Promise<boolean> {
  const cityNormalized = normalizeAddressText(city)
  const postal = postalCode.trim()
  if (!cityNormalized || !/^\d{5}$/.test(postal)) {
    return false
  }
  const features = await search(postal, { type: 'municipality', limit: '20' })
  return features.some((feature) => {
    const properties = feature.properties
    const names = [properties?.city, properties?.name, properties?.label]
      .filter((value): value is string => !!value)
    const cityMatches = names.some((name) => normalizeAddressText(name) === cityNormalized)
    const postalMatches = !properties?.postcode || properties.postcode === postal
    return cityMatches && postalMatches
  })
}

/** Vérifie que la rue existe bien pour le code postal / la ville donnés (France). */
export async function frenchAddressExists(
  streetInput: string,
  postalCode: string,
  city: string,
): Promise<boolean> {
  // Un éventuel numéro de voie est ignoré pour la vérification de l'existence de la rue.
  const { street } = splitStreetNumber(streetInput)
  const streetNormalized = normalizeAddressText(street)
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
      const normalized = normalizeAddressText(name)
      return normalized === streetNormalized
        || normalized.startsWith(streetNormalized)
        || streetNormalized.startsWith(normalized)
    })
    const cityMatches = !properties?.city
      || normalizeAddressText(properties.city) === normalizeAddressText(city)
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
  const prefix = normalizeAddressText(street)
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
    .filter((value) => normalizeAddressText(value).startsWith(prefix))
    .slice(0, 5)
    .map((value) => (number ? `${number} ${value}` : value))
}
