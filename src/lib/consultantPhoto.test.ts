import { describe, expect, it } from 'vitest'
import { MAX_CONSULTANT_PHOTO_BYTES, consultantInitials, validateConsultantPhotoFile } from './consultantPhoto'

function file(name: string, type: string, size = 10): File {
  const content = new Uint8Array(size)
  return new File([content], name, { type })
}

describe('validateConsultantPhotoFile', () => {
  it('accepte un PNG ou JPEG sous la limite', () => {
    expect(validateConsultantPhotoFile(file('photo.png', 'image/png'))).toBeNull()
    expect(validateConsultantPhotoFile(file('photo.jpg', 'image/jpeg'))).toBeNull()
    expect(validateConsultantPhotoFile(file('photo.JPEG', 'image/jpeg'))).toBeNull()
  })

  it('refuse les formats non supportés', () => {
    expect(validateConsultantPhotoFile(file('photo.gif', 'image/gif'))).toBe('format')
    expect(validateConsultantPhotoFile(file('photo.png', 'image/gif'))).toBe('format')
    expect(validateConsultantPhotoFile(file('photo', 'image/png'))).toBe('format')
  })

  it('refuse les fichiers de plus de 5 Mo', () => {
    expect(validateConsultantPhotoFile(file('photo.png', 'image/png', MAX_CONSULTANT_PHOTO_BYTES + 1))).toBe(
      'taille',
    )
  })
})

describe('consultantInitials', () => {
  it('retourne les initiales', () => {
    expect(consultantInitials('Jean', 'Dupont')).toBe('JD')
    expect(consultantInitials('jean', 'dupont')).toBe('JD')
    expect(consultantInitials(null, 'Dupont')).toBe('D')
  })
})
