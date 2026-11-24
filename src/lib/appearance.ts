import type { EffectiveAppearanceDto } from '../api/types'

const CSS_VARIABLES: Record<string, string[]> = {
  primaryColor: ['--brand-500', '--brand-600'],
  secondaryColor: ['--brand-900'],
  backgroundColor: ['--app-bg-color'],
  menuColor: ['--menu-color'],
}

/**
 * Applique l'apparence effective au document. Les paramètres hérités uniquement de la
 * configuration globale ne sont pas appliqués ici afin de préserver l'apparence existante des
 * comptes qui ne se sont pas encore personnalisés via la nouvelle hiérarchie.
 */
export function applyAppearance(effective: EffectiveAppearanceDto): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const [key, variables] of Object.entries(CSS_VARIABLES)) {
    const source = effective.sources?.[key]
    const value = effective.config?.[key]
    if (!value || source === 'GLOBAL') continue
    for (const variable of variables) {
      root.style.setProperty(variable, value)
    }
  }
}
