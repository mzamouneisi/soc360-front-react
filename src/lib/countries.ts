import { normalize } from './frenchAddress'

/** Codes ISO 3166-1 alpha-2 des pays et territoires, utilisés pour proposer les pays en français. */
const REGION_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ '
  + 'BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM '
  + 'DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS '
  + 'GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN '
  + 'KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ '
  + 'MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM '
  + 'PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV '
  + 'SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI '
  + 'VN VU WF WS YE YT ZA ZM ZW'
).split(' ')

type DisplayNamesConstructor = new (
  locales: string[],
  options: { type: 'region' },
) => { of: (code: string) => string | undefined }

function buildCountryNames(): string[] {
  const DisplayNames = (Intl as unknown as { DisplayNames?: DisplayNamesConstructor }).DisplayNames
  if (!DisplayNames) {
    return []
  }
  const displayNames = new DisplayNames(['fr'], { type: 'region' })
  return REGION_CODES
    .map((code) => displayNames.of(code))
    .filter((name): name is string => !!name && name !== '')
    .sort((first, second) => first.localeCompare(second, 'fr'))
}

/** Noms de pays en français, triés alphabétiquement. */
export const COUNTRY_NAMES: string[] = buildCountryNames()

/** Suggestions de pays commençant par la saisie (insensible à la casse et aux accents). */
export function findCountrySuggestions(query: string, limit = 8): string[] {
  const prefix = normalize(query)
  if (!prefix) {
    return COUNTRY_NAMES.slice(0, limit)
  }
  return COUNTRY_NAMES.filter((name) => normalize(name).startsWith(prefix)).slice(0, limit)
}
