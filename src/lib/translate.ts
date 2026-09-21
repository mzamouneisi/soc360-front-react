import translate from 'translate'

const CONCURRENCY = 5

export interface TextToTranslate {
  key: string
  text: string
}

export async function translateTexts(
  texts: TextToTranslate[],
  from: string,
  to: string,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {}
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < texts.length) {
      const current = texts[cursor++]
      try {
        const value = await translate(current.text, { from, to })
        if (value && value.trim()) {
          results[current.key] = value
        }
      } catch {
        // traduction indisponible pour cette chaîne : on l'ignore
      }
    }
  }

  const workers = Math.max(1, Math.min(CONCURRENCY, texts.length))
  await Promise.all(Array.from({ length: workers }, worker))
  return results
}
