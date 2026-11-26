import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// happy-dom ne sait pas charger une iframe dont la source est une URL « blob: » (aperçus PDF).
// En test, on neutralise ces sources par « about:blank » pour éviter une NotSupportedError
// attendue qui pollue la sortie ; le contenu de l'iframe n'est pas testé.
const iframeSrc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src')
if (iframeSrc?.set) {
  Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
    configurable: true,
    enumerable: iframeSrc.enumerable,
    get: iframeSrc.get,
    set(this: HTMLIFrameElement, value: string) {
      iframeSrc.set!.call(this, value.startsWith('blob:') ? 'about:blank' : value)
    },
  })
}

const originalSetAttribute = Element.prototype.setAttribute
Element.prototype.setAttribute = function setAttribute(name: string, value: string) {
  const safeValue = this instanceof HTMLIFrameElement && name === 'src' && value.startsWith('blob:')
    ? 'about:blank'
    : value
  return originalSetAttribute.call(this, name, safeValue)
}

afterEach(() => {
  cleanup()
})
