import { describe, expect, it } from 'vitest'
import { isAllowedNoteFraisDocument } from './noteFraisDocument'

function file(name: string, type = ''): File {
  return new File(['x'], name, { type })
}

describe('isAllowedNoteFraisDocument', () => {
  it('accepte les images PNG/JPG/JPEG et les PDF', () => {
    expect(isAllowedNoteFraisDocument(file('facture.png', 'image/png'))).toBe(true)
    expect(isAllowedNoteFraisDocument(file('facture.JPG', 'image/jpeg'))).toBe(true)
    expect(isAllowedNoteFraisDocument(file('facture.jpeg', 'image/jpeg'))).toBe(true)
    expect(isAllowedNoteFraisDocument(file('facture.pdf', 'application/pdf'))).toBe(true)
  })

  it('refuse les autres formats', () => {
    expect(isAllowedNoteFraisDocument(file('facture.txt', 'text/plain'))).toBe(false)
    expect(isAllowedNoteFraisDocument(file('facture.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe(false)
    expect(isAllowedNoteFraisDocument(file('facture.gif', 'image/gif'))).toBe(false)
    expect(isAllowedNoteFraisDocument(file('facture', ''))).toBe(false)
  })

  it('refuse un type MIME incohérent avec l’extension', () => {
    expect(isAllowedNoteFraisDocument(file('facture.pdf', 'text/plain'))).toBe(false)
    expect(isAllowedNoteFraisDocument(file('facture.png', 'application/pdf'))).toBe(false)
  })
})
