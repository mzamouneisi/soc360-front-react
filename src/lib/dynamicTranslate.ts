import { translateTexts } from './translate'

const cache: Record<string, Record<string, string>> = {}
const pending: Record<string, Set<string>> = {}
const listeners = new Set<() => void>()

let currentLanguage = 'fr'
let version = 0
let flushTimer: ReturnType<typeof setTimeout> | null = null
let running = false

export function setDynamicLanguage(language: string): void {
  const next = language || 'fr'
  if (next === currentLanguage) return
  currentLanguage = next
  version += 1
  listeners.forEach((listener) => listener())
}

export function subscribeDynamic(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getDynamicVersion(): number {
  return version
}

export function dynamicTranslate(text: string | null | undefined): string {
  if (text == null) return ''
  const value = text.trim()
  if (!value || currentLanguage === 'fr') return text
  const cached = cache[currentLanguage]?.[value]
  if (cached) return cached
  queue(value)
  return text
}

function queue(text: string): void {
  ;(pending[currentLanguage] ??= new Set()).add(text)
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    void flush()
  }, 60)
}

async function flush(): Promise<void> {
  flushTimer = null
  if (running) return
  running = true
  try {
    const language = currentLanguage
    const values = Array.from(pending[language] ?? [])
    pending[language]?.clear()
    if (values.length && language !== 'fr') {
      const results = await translateTexts(
        values.map((text) => ({ key: text, text })),
        'fr',
        language,
      )
      cache[language] ??= {}
      let changed = false
      for (const text of values) {
        const translated = results[text]
        if (translated && translated.trim() && translated !== text) {
          cache[language][text] = translated
          changed = true
        }
      }
      if (changed) {
        version += 1
        listeners.forEach((listener) => listener())
      }
    }
  } finally {
    running = false
    if (Object.values(pending).some((set) => set.size > 0)) {
      flushTimer = setTimeout(() => {
        void flush()
      }, 60)
    }
  }
}
