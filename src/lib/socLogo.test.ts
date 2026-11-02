import { describe, expect, it } from 'vitest'
import { MAX_SOC_LOGO_BYTES, validateSocLogoFile } from './socLogo'

function file(name: string, type: string, size = 10): File {
  const content = new Uint8Array(size)
  return new File([content], name, { type })
}

describe('validateSocLogoFile', () => {
  it('accepte un PNG ou JPEG sous la limite', () => {
    expect(validateSocLogoFile(file('logo.png', 'image/png'))).toBeNull()
    expect(validateSocLogoFile(file('logo.jpg', 'image/jpeg'))).toBeNull()
    expect(validateSocLogoFile(file('logo.JPEG', 'image/jpeg'))).toBeNull()
  })

  it('refuse les formats non supportés', () => {
    expect(validateSocLogoFile(file('logo.gif', 'image/gif'))).toBe('format')
    expect(validateSocLogoFile(file('logo.png', 'image/gif'))).toBe('format')
    expect(validateSocLogoFile(file('logo', 'image/png'))).toBe('format')
  })

  it('refuse les fichiers de plus de 2 Mo', () => {
    expect(validateSocLogoFile(file('logo.png', 'image/png', MAX_SOC_LOGO_BYTES + 1))).toBe('taille')
  })
})
